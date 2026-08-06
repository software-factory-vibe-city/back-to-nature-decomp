import { existsSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";
import type { CompilerTraceReport } from "../compilerTrace.js";
import type { TraceConfidence } from "../compiler-trace/types.js";
import type { TargetScheduleAnalysis } from "../target-schedule/types.js";
import type { MacroRegistry } from "./macro-forms.js";
import { blockIsFrozen, immediateValues } from "./semantic-graph.js";
import { parseMemoryToken, memoryEffectsConflict } from "./topological-orders.js";
import { websCompatible, type WebView } from "./web-partitions.js";
import {
  RESIDUAL_SEARCH_SCHEMA_VERSION,
  type BaselineBundle,
  type CausalClosure,
  type ClosureItem,
  type ClosureReason,
  type EligibilityRefusal,
  type SemanticGraph,
} from "./types.js";

export interface ClosureInputs {
  graph: SemanticGraph;
  view: WebView;
  bundle: BaselineBundle;
  trace: CompilerTraceReport;
  analysis: TargetScheduleAnalysis;
  registry: MacroRegistry;
  /** Directory containing the baseline pass dumps (source-line note binding). */
  dumpDirectory: string;
  sourceFileName: string;
}

const CONFIDENCE_RANK: Record<TraceConfidence, number> = { exact: 3, reconstructed: 2, inferred: 1 };

function betterConfidence(left: TraceConfidence, right: TraceConfidence): TraceConfidence {
  return CONFIDENCE_RANK[left] >= CONFIDENCE_RANK[right] ? left : right;
}

/**
 * Map candidate RTL uids to original-source lines via first-dump source-line
 * notes. GCC 2.95 emits them as `(note u p n "file" line)` or the
 * parenthesized `(note u p n ("file") line)` form; byte offsets order the
 * note/insn interleaving.
 */
export function bindUidLines(dumpDirectory: string, functionName: string, sourceFileName: string): Map<number, number> {
  const result = new Map<number, number>();
  const path = join(dumpDirectory, `${functionName}.i.rtl`);
  if (!existsSync(path)) return result;
  const content = readFileSync(path, "utf8");
  const wanted = basename(sourceFileName);
  const events: Array<{ at: number; kind: "line" | "insn"; line?: number; uid?: number }> = [];
  for (const match of content.matchAll(/^\(note\s+\d+\s+\d+\s+\d+\s+\(?"([^"]+)"\)?\s+(\d+)\s*\)/gm)) {
    if (basename(match[1]!) !== wanted) continue;
    events.push({ at: match.index!, kind: "line", line: Number(match[2]) });
  }
  for (const match of content.matchAll(/^\((?:insn|jump_insn|call_insn)\s+(\d+)/gm)) {
    events.push({ at: match.index!, kind: "insn", uid: Number(match[1]) });
  }
  events.sort((left, right) => left.at - right.at);
  let currentLine: number | undefined;
  for (const event of events) {
    if (event.kind === "line") currentLine = event.line;
    else if (currentLine !== undefined && event.uid !== undefined) result.set(event.uid, currentLine);
  }
  return result;
}

export function deriveCausalClosure(inputs: ClosureInputs): CausalClosure {
  const { graph, view, bundle, trace, analysis } = inputs;
  const items = new Map<string, ClosureItem>();
  const queue: string[] = [];

  const add = (id: string, reason: ClosureReason): void => {
    const existing = items.get(id);
    if (existing) {
      const duplicate = existing.reasons.some((item) =>
        item.kind === reason.kind && item.from === reason.from && item.detail === reason.detail);
      if (!duplicate && existing.reasons.length < 24) existing.reasons.push(reason);
      existing.confidence = betterConfidence(existing.confidence, reason.confidence);
      return;
    }
    items.set(id, { id, reasons: [reason], confidence: reason.confidence });
    queue.push(id);
  };

  /* -------------------------------------------------------------- */
  /* Indexes                                                         */
  /* -------------------------------------------------------------- */

  const correspondence = new Map(analysis.correspondence.map((entry) => [entry.targetIndex, entry]));
  const uidToPseudos = new Map<number, Set<number>>();
  const pseudoToUids = new Map<number, Set<number>>();
  for (const pseudo of trace.pseudos) {
    const uids = new Set<number>();
    for (const stage of pseudo.stages) {
      for (const uid of [...stage.setUids, ...stage.useUids, ...stage.deathUids]) uids.add(uid);
    }
    pseudoToUids.set(pseudo.pseudo, uids);
    for (const uid of uids) {
      const bucket = uidToPseudos.get(uid) || new Set<number>();
      bucket.add(pseudo.pseudo);
      uidToPseudos.set(uid, bucket);
    }
  }
  const pseudoRecords = new Map(trace.pseudos.map((pseudo) => [pseudo.pseudo, pseudo]));

  /* Statements the search can act on. A frozen construct is represented by its
   * own summary node, so binding a mismatch to a statement buried inside one
   * would name something the grammar cannot move. */
  const reachable = graph.nodes.filter((node) => !blockIsFrozen(graph.blocks, node.block));

  const uidLines = bindUidLines(inputs.dumpDirectory, bundle.function, inputs.sourceFileName);
  const nodesByLine = (line: number) => reachable
    .filter((node) => node.span.lineStart <= line && node.span.lineEnd >= line)
    .sort((left, right) => (left.span.end - left.span.start) - (right.span.end - right.span.start));

  const nodeConstants = new Map<string, Set<number>>();
  for (const node of reachable) {
    if (node.kind === "if") continue;
    const constants = new Set(immediateValues(node.text));
    if (node.kind === "known-macro" && node.macro) {
      const macro = inputs.registry.active.get(node.macro);
      for (const value of macro?.bodyConstants || []) constants.add(value);
    }
    nodeConstants.set(node.id, constants);
  }

  const variableNames = new Set(graph.variables.map((variable) => variable.name));
  const websByNode = new Map<string, Set<string>>();
  for (const web of view.webs) {
    for (const node of [...web.defNodes, ...web.useNodes]) {
      if (node === "param-entry") continue;
      const bucket = websByNode.get(node) || new Set<string>();
      bucket.add(web.id);
      websByNode.set(node, bucket);
    }
  }

  const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));
  const blockById = new Map(graph.blocks.map((block) => [block.index, block]));
  const memoryEffectsOf = (nodeId: string) => {
    const node = nodeById.get(nodeId)!;
    const webAt = (variable: string) => view.reaching.get(nodeId)?.get(variable) ?? view.defWebs.get(nodeId)?.get(variable);
    const parse = (token: string) => parseMemoryToken(token, webAt, (name) => variableNames.has(name));
    return { reads: node.memoryReads.map(parse), writes: node.memoryWrites.map(parse) };
  };

  const allocationRank = new Map(trace.allocationOrder.map((entry) => [entry.pseudo, entry.rank]));
  const pseudoAtRank = new Map(trace.allocationOrder.map((entry) => [entry.rank, entry.pseudo]));

  /* -------------------------------------------------------------- */
  /* Seeds                                                           */
  /* -------------------------------------------------------------- */

  const seeds: string[] = [];
  for (const index of bundle.mismatchedTargetIndexes) {
    const id = `target:${index}`;
    seeds.push(id);
    add(id, {
      kind: "mismatched-instruction",
      from: "residual-diff",
      detail: `target[${index}] ${analysis.target[index]?.canonical ?? "<missing>"} != candidate ${analysis.candidate[index]?.canonical ?? "<missing>"}`,
      confidence: "exact",
    });
  }

  /* -------------------------------------------------------------- */
  /* Fixed-point expansion                                           */
  /* -------------------------------------------------------------- */

  while (queue.length > 0) {
    const id = queue.shift()!;
    const [kind, rawValue] = id.split(":", 2) as [string, string];

    if (kind === "target") {
      const index = Number(rawValue);
      const entry = correspondence.get(index);
      if (entry?.candidateIndex !== undefined) {
        add(`cand:${entry.candidateIndex}`, {
          kind: "uid-correspondence",
          from: id,
          detail: `target/candidate correspondence (${entry.confidence})`,
          confidence: entry.confidence,
        });
      }
      if (entry?.candidateUid !== undefined) {
        add(`uid:${entry.candidateUid}`, {
          kind: "uid-correspondence",
          from: id,
          detail: "correspondence candidate uid",
          confidence: entry.confidence,
        });
      }
      const constants = immediateValues(analysis.target[index]?.canonical || "");
      for (const [nodeId, values] of nodeConstants) {
        if (constants.some((value) => value !== 0 && values.has(value))) {
          add(`node:${nodeId}`, {
            kind: "constant-binding",
            from: id,
            detail: `statement or configured macro body carries immediate ${constants.filter((value) => values.has(value)).join("/")}`,
            confidence: "inferred",
          });
        }
      }
      for (const role of analysis.registerRoles) {
        if (role.targetIndexes.includes(index)) {
          for (const pseudo of role.pseudos) {
            add(`pseudo:${pseudo}`, {
              kind: "register-role",
              from: id,
              detail: `register role ${role.targetRegister}->${role.candidateRegister}`,
              confidence: role.confidence,
            });
          }
        }
      }
      continue;
    }

    if (kind === "cand") {
      const index = Number(rawValue);
      const instruction = analysis.candidate[index];
      if (!instruction) continue;
      if (instruction.uid !== undefined) {
        add(`uid:${instruction.uid}`, { kind: "uid-correspondence", from: id, detail: "final emission uid", confidence: "exact" });
      }
      for (const uid of instruction.candidateUids || []) {
        add(`uid:${uid}`, { kind: "uid-correspondence", from: id, detail: "candidate emission uid", confidence: "reconstructed" });
      }
      continue;
    }

    if (kind === "uid") {
      const uid = Number(rawValue);
      for (const pseudo of uidToPseudos.get(uid) || []) {
        add(`pseudo:${pseudo}`, { kind: "pseudo-def-use", from: id, detail: "pseudo set/use/death at this uid", confidence: "exact" });
      }
      const line = uidLines.get(uid);
      if (line !== undefined) {
        const candidates = nodesByLine(line);
        const best = candidates.find((node) => node.kind !== "if") ?? candidates[0];
        if (best) {
          add(`node:${best.id}`, {
            kind: "source-line-binding",
            from: id,
            detail: `rtl source-line note ${line}`,
            confidence: candidates.length === 1 ? "exact" : "reconstructed",
          });
        }
      }
      for (const scheduler of trace.schedulers) {
        for (const edge of scheduler.dependencies) {
          if (edge.fromUid === uid) {
            add(`uid:${edge.toUid}`, {
              kind: "scheduler-dependency",
              from: id,
              detail: `${scheduler.stage} ${edge.kind} dependency`,
              confidence: edge.confidence,
            });
          } else if (edge.toUid === uid) {
            add(`uid:${edge.fromUid}`, {
              kind: "scheduler-dependency",
              from: id,
              detail: `${scheduler.stage} ${edge.kind} dependency`,
              confidence: edge.confidence,
            });
          }
        }
        for (const decision of scheduler.decisions) {
          if (decision.ready.some((entry) => entry.uid === uid)) {
            for (const entry of decision.ready) {
              if (entry.uid !== uid) {
                add(`uid:${entry.uid}`, {
                  kind: "ready-list-competitor",
                  from: id,
                  detail: `${scheduler.stage} block ${decision.block} cycle ${decision.cycle} ready-list competitor`,
                  confidence: "exact",
                });
              }
            }
          }
        }
      }
      for (const slot of analysis.delaySlots) {
        const related = [slot.branchUid, slot.candidateDelayUid, slot.desiredCandidateUid, ...slot.eligibleUids, ...slot.ownBlockScanUids];
        if (related.includes(uid)) {
          for (const other of [...slot.eligibleUids, ...slot.ownBlockScanUids]) {
            if (other !== uid) {
              add(`uid:${other}`, {
                kind: "delay-slot-candidate",
                from: id,
                detail: `delay-slot scan for branch target ${slot.branchTargetIndex}`,
                confidence: slot.confidence,
              });
            }
          }
        }
      }
      continue;
    }

    if (kind === "pseudo") {
      const pseudo = Number(rawValue);
      for (const uid of pseudoToUids.get(pseudo) || []) {
        add(`uid:${uid}`, { kind: "pseudo-def-use", from: id, detail: "uid touching this pseudo", confidence: "exact" });
      }
      const record = pseudoRecords.get(pseudo);
      for (const transition of record?.transitions || []) {
        for (const related of transition.relatedPseudos) {
          add(`pseudo:${related}`, {
            kind: "pseudo-transition",
            from: id,
            detail: `${transition.fromStage}->${transition.toStage} ${transition.kind}`,
            confidence: transition.confidence,
          });
        }
      }
      for (const conflict of record?.conflicts || []) {
        if (conflict.kind === "pseudo") {
          add(`pseudo:${conflict.register}`, {
            kind: "allocation-conflict",
            from: id,
            detail: "allocno conflict",
            confidence: conflict.confidence,
          });
        }
      }
      const rank = allocationRank.get(pseudo);
      if (rank !== undefined) {
        for (const neighborRank of [rank - 1, rank + 1]) {
          const neighbor = pseudoAtRank.get(neighborRank);
          if (neighbor !== undefined) {
            add(`pseudo:${neighbor}`, {
              kind: "allocation-order-neighbor",
              from: id,
              detail: `allocation order rank ${neighborRank}`,
              confidence: "exact",
            });
          }
        }
      }
      continue;
    }

    if (kind === "node") {
      const nodeId = rawValue;
      const node = nodeById.get(nodeId);
      if (!node) continue;
      for (const webId of websByNode.get(nodeId) || []) {
        const web = view.websById.get(webId)!;
        add(`web:${webId}`, {
          kind: web.defNodes.includes(nodeId) ? "value-producer" : "value-consumer",
          from: id,
          detail: `statement ${web.defNodes.includes(nodeId) ? "defines" : "uses"} ${webId}`,
          confidence: "exact",
        });
      }
      /* Memory-order anchors: same-block statements whose effects cannot commute. */
      if (node.memoryReads.length > 0 || node.memoryWrites.length > 0) {
        const own = memoryEffectsOf(nodeId);
        for (const other of reachable) {
          if (other.id === nodeId || other.block !== node.block) continue;
          if (other.memoryReads.length === 0 && other.memoryWrites.length === 0) continue;
          const theirs = memoryEffectsOf(other.id);
          const conflict =
            own.writes.some((left) => [...theirs.reads, ...theirs.writes].some((right) => memoryEffectsConflict(left, right))) ||
            theirs.writes.some((left) => own.reads.some((right) => memoryEffectsConflict(left, right)));
          if (conflict) {
            add(`node:${other.id}`, {
              kind: "memory-order-anchor",
              from: id,
              detail: "conservative memory effects constrain legal order",
              confidence: "exact",
            });
          }
        }
      }
      const block = blockById.get(node.block);
      if (block?.controllingIf) {
        add(`node:${block.controllingIf}`, {
          kind: "controlling-branch",
          from: id,
          detail: "branch predicate controls path-safe liveness for this statement",
          confidence: "exact",
        });
      }
      continue;
    }

    if (kind === "web") {
      const web = view.websById.get(rawValue);
      if (!web) continue;
      for (const nodeId of [...web.defNodes, ...web.useNodes]) {
        if (nodeId === "param-entry") continue;
        add(`node:${nodeId}`, {
          kind: web.defNodes.includes(nodeId) ? "value-producer" : "value-consumer",
          from: id,
          detail: `web member statement`,
          confidence: "exact",
        });
      }
      for (const other of view.webs) {
        if (other.id === web.id) continue;
        if (websCompatible(web, other)) {
          add(`web:${other.id}`, {
            kind: "compatible-web",
            from: id,
            detail: "merge-compatible value web (disjoint liveness, same representation type)",
            confidence: "inferred",
          });
        }
      }
      continue;
    }
  }

  const nodeIds = [...items.keys()].filter((id) => id.startsWith("node:")).map((id) => id.slice(5));
  const webIds = [...items.keys()].filter((id) => id.startsWith("web:")).map((id) => id.slice(4));
  const uids = [...items.keys()].filter((id) => id.startsWith("uid:")).map((id) => Number(id.slice(4))).sort((a, b) => a - b);
  const pseudos = [...items.keys()].filter((id) => id.startsWith("pseudo:")).map((id) => Number(id.slice(7))).sort((a, b) => a - b);
  const movable = reachable.filter((node) => node.movable);
  const nodeSet = new Set(nodeIds);
  const orderIndex = new Map(graph.nodes.map((node, index) => [node.id, index]));

  return {
    schemaVersion: RESIDUAL_SEARCH_SCHEMA_VERSION,
    function: bundle.function,
    seeds,
    items: [...items.values()].sort((left, right) => left.id.localeCompare(right.id, undefined, { numeric: true })),
    nodeIds: nodeIds.sort((left, right) => (orderIndex.get(left) ?? 0) - (orderIndex.get(right) ?? 0)),
    webIds: webIds.sort(),
    uids,
    pseudos,
    wholeFunction: movable.length > 0 && movable.every((node) => nodeSet.has(node.id)),
    caveats: uidLines.size === 0
      ? ["No first-dump source-line notes were found; statement binding relies on constants, roles, and web edges only."]
      : [],
  };
}

/** Refusals that depend on the derived closure. */
export function closureRefusal(closure: CausalClosure, graph: SemanticGraph): EligibilityRefusal | undefined {
  if (closure.nodeIds.length === 0) {
    return {
      status: "unsupported-correspondence",
      reason: "target/candidate correspondence is ambiguous for every mismatch: no source statement could be bound",
      evidence: closure.seeds,
    };
  }
  const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));
  const seedBound = closure.items.filter((item) =>
    item.id.startsWith("node:") && item.reasons.some((reason) =>
      reason.kind === "source-line-binding" || reason.kind === "constant-binding"));
  if (seedBound.length > 0 && seedBound.every((item) => {
    const node = nodeById.get(item.id.slice(5));
    return node !== undefined && (node.kind === "unknown" || node.kind === "call");
  })) {
    return {
      status: "unsupported-source",
      reason: "semantic source contains an unknown-effect construct in the only causal region",
      evidence: seedBound.map((item) => item.id),
    };
  }
  return undefined;
}
