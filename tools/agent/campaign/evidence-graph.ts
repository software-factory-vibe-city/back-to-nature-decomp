/**
 * The evidence graph — what a newly recovered fact changes, and what it does
 * not.
 *
 * A campaign that re-runs everything after every success is doing
 * quadratically more work than it needs to, and a campaign that re-runs
 * nothing never benefits from what it learned. The difference is a dependency
 * relation, and this is it:
 *
 *   - **calls**: a caller depends on its callees' signatures. When a callee
 *     becomes matched, its arity and return type stop being an ABI bound and
 *     become a declaration, which changes what its callers can construct.
 *   - **family**: members of one shape depend on each other. When any member
 *     gets clean C, every other member acquires a donor.
 *   - **storage**: two functions that touch the same global depend on a shared
 *     layout. When one witnesses a field, the other's view can use it.
 *
 * Nothing else is a dependency. Two functions in the same container, or in the
 * same source file, do not affect each other's reconstruction, and treating
 * them as dependents is how a requeue becomes a whole-project rerun.
 *
 * The graph is built from target-side artifacts only — `jal` targets, word
 * shapes, materialised addresses — so it is available before any of the
 * functions in it has C.
 */

import { loadContainers, type Container } from "../../lib/container.js";
import { loadFunctionSpans, loadSymbolIndex, resolveAddress } from "../../lib/symbolIndex.js";
import { decodeFunctionWords } from "../family-transfer/signature.js";
import { buildFamilyIndex, type FamilyIndex } from "../family-transfer/family-index.js";
import { isLoad, isStore, type DecodedInsn } from "../matching-reconstruction/decode.js";
import { overlayRevision } from "./artifact-overlay.js";

export type DependencyKind = "calls" | "family" | "storage";

export interface EvidenceEdge {
  from: string;
  to: string;
  kind: DependencyKind;
  /** What the edge rests on, in words a reader can check. */
  evidence: string;
}

export interface EvidenceGraph {
  /** Every function the graph covers. */
  functions: string[];
  edges: EvidenceEdge[];
  /** `callee → callers`, the direction a requeue travels. */
  callersOf: Map<string, Set<string>>;
  /** `function → the other members of its family`. */
  familyOf: Map<string, Set<string>>;
  /** `function → the other functions that touch a global it touches`. */
  storagePeersOf: Map<string, Set<string>>;
  notes: string[];
}

/** Absolute addresses one function's words name, from hi/lo pairs. */
function namedAddresses(insns: DecodedInsn[]): Set<number> {
  const pending = new Map<number, number>();
  const addresses = new Set<number>();
  for (const insn of insns) {
    if (insn.op === "lui") {
      pending.set(insn.rt, (insn.uimm << 16) >>> 0);
      continue;
    }
    const high = pending.get(insn.rs);
    const writes = insn.rt !== 0 && insn.rt !== insn.rs;
    if (high !== undefined) {
      if (isLoad(insn.op) || isStore(insn.op) || insn.op === "addiu") {
        addresses.add((high + insn.simm) >>> 0);
      } else if (insn.op === "ori") {
        addresses.add((high + insn.uimm) >>> 0);
      }
    }
    if (writes) pending.delete(insn.rt);
  }
  return addresses;
}

export interface BuildGraphOptions {
  containers?: Container[];
  /** Prebuilt family index, when the caller already has one. */
  familyIndex?: FamilyIndex;
  /**
   * Globals touched by more than this many functions are dropped from the
   * storage relation. A table half the overlay reads is not a dependency
   * between its readers; it is a fact about the overlay, and keeping it would
   * make one recovered field requeue everything.
   */
  storageFanoutLimit?: number;
  onProgress?: ((done: number, total: number) => void) | undefined;
}

/**
 * One graph per configuration, built once per process.
 *
 * Building it decodes every configured function and resolves every `jal`.
 * That is seconds, which is nothing once and far too much per query — and a
 * campaign, a bundle and a repair report in one run each want the same graph.
 */
const graphCache = new Map<string, EvidenceGraph>();

export function buildEvidenceGraph(options: BuildGraphOptions = {}): EvidenceGraph {
  const cacheKey = JSON.stringify({
    containers: (options.containers ?? loadContainers()).map((container) => container.id).sort(),
    fanout: options.storageFanoutLimit ?? 8,
    /* The family relation comes from the family index, whose donors change when
     * a recovery is published. Caching across a publication would hand a
     * campaign's later rounds the donor sets of its first one. */
    overlay: overlayRevision(),
  });
  const cached = graphCache.get(cacheKey);
  if (cached) return cached;
  const built = computeEvidenceGraph(options);
  graphCache.set(cacheKey, built);
  return built;
}

function computeEvidenceGraph(options: BuildGraphOptions): EvidenceGraph {
  const containers = options.containers ?? loadContainers();
  const familyIndex = options.familyIndex ?? buildFamilyIndex({ tier: "flexible" });
  const fanoutLimit = options.storageFanoutLimit ?? 8;
  const notes: string[] = [];

  const functions: string[] = [];
  const edges: EvidenceEdge[] = [];
  const callersOf = new Map<string, Set<string>>();
  const storagePeersOf = new Map<string, Set<string>>();
  const touchedBy = new Map<number, Set<string>>();

  const spans = containers.flatMap((container) =>
    loadFunctionSpans(container).map((span) => ({ container, span })));

  spans.forEach(({ container, span }, index) => {
    options.onProgress?.(index, spans.length);
    let insns: DecodedInsn[];
    try {
      insns = decodeFunctionWords(span.name).insns;
    } catch {
      return;
    }
    functions.push(span.name);

    let symbolIndex: ReturnType<typeof loadSymbolIndex> | undefined;
    try {
      symbolIndex = loadSymbolIndex(container);
    } catch {
      symbolIndex = undefined;
    }

    /* calls: a `jal` target is absolute, so this needs no execution. */
    for (const insn of insns) {
      if (insn.op !== "jal" || insn.target === undefined) continue;
      const resolved = symbolIndex ? resolveAddress(symbolIndex, insn.target >>> 0) : null;
      if (!resolved || resolved.offset !== 0) continue;
      edges.push({
        from: span.name,
        to: resolved.symbol,
        kind: "calls",
        evidence: `jal at 0x${insn.vram.toString(16)}`,
      });
      callersOf.set(resolved.symbol, (callersOf.get(resolved.symbol) ?? new Set()).add(span.name));
    }

    /* storage: the absolute addresses this function's words name. */
    for (const address of namedAddresses(insns)) {
      touchedBy.set(address, (touchedBy.get(address) ?? new Set()).add(span.name));
    }
  });

  /* Storage peers, after the fan-out filter. */
  let droppedGlobals = 0;
  for (const [address, readers] of touchedBy) {
    if (readers.size < 2) continue;
    if (readers.size > fanoutLimit) { droppedGlobals++; continue; }
    for (const reader of readers) {
      const peers = storagePeersOf.get(reader) ?? new Set<string>();
      for (const other of readers) if (other !== reader) peers.add(other);
      storagePeersOf.set(reader, peers);
      for (const other of readers) {
        if (other === reader) continue;
        edges.push({
          from: reader,
          to: other,
          kind: "storage",
          evidence: `both name 0x${address.toString(16)}`,
        });
      }
    }
  }
  if (droppedGlobals > 0) {
    notes.push(
      `${droppedGlobals} global(s) are named by more than ${fanoutLimit} functions and are not treated as ` +
      "dependencies; a table half a container reads is a fact about the container, not a relation between its readers",
    );
  }

  /* family: every other member of a function's shape. */
  const familyOf = new Map<string, Set<string>>();
  for (const family of familyIndex.families) {
    for (const member of family.members) {
      const peers = new Set(family.members.map((other) => other.functionName));
      peers.delete(member.functionName);
      if (peers.size === 0) continue;
      familyOf.set(member.functionName, peers);
      for (const peer of peers) {
        edges.push({ from: member.functionName, to: peer, kind: "family", evidence: `shape ${family.shape}` });
      }
    }
  }

  return { functions, edges, callersOf, familyOf, storagePeersOf, notes };
}

/**
 * What a newly recovered function changes.
 *
 * Its callers, because their callee's signature is now a declaration rather
 * than a bound; its family, because they now have a donor; and the functions
 * that share a global with it, because its witnessed geometry is theirs too.
 * Nothing else — and that bound is the whole point: a requeue that returns the
 * project is not a requeue.
 */
export function dependentsOf(graph: EvidenceGraph, functionName: string): Set<string> {
  const dependents = new Set<string>();
  for (const caller of graph.callersOf.get(functionName) ?? []) dependents.add(caller);
  for (const member of graph.familyOf.get(functionName) ?? []) dependents.add(member);
  for (const peer of graph.storagePeersOf.get(functionName) ?? []) dependents.add(peer);
  dependents.delete(functionName);
  return dependents;
}

/** A summary a reader can check the shape of the graph against. */
export function describeGraph(graph: EvidenceGraph): string[] {
  const byKind = new Map<DependencyKind, number>();
  for (const edge of graph.edges) byKind.set(edge.kind, (byKind.get(edge.kind) ?? 0) + 1);
  const lines = [
    `${graph.functions.length} function(s), ${graph.edges.length} dependency edge(s)`,
  ];
  for (const [kind, count] of [...byKind].sort()) lines.push(`  ${kind}: ${count}`);
  const fanout = graph.functions
    .map((name) => ({ name, count: dependentsOf(graph, name).size }))
    .sort((left, right) => right.count - left.count);
  lines.push(`  widest dependent set: ${fanout[0]?.name ?? "(none)"} with ${fanout[0]?.count ?? 0}`);
  const median = fanout.length > 0 ? fanout[Math.floor(fanout.length / 2)]!.count : 0;
  lines.push(`  median dependent set: ${median}`);
  for (const note of graph.notes) lines.push(`  note: ${note}`);
  return lines;
}
