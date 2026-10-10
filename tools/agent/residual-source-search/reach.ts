/** Scope warnings, never a refusal or a proof that clean C cannot match. */
import { best, type LedgerEntry } from "../experimentLedger.js";
import { orientationFrom } from "../branch-orientation.js";
import type { ReversalArtifacts } from "../pipeline-reversal/reverse.js";
import type { TargetScheduleAnalysis } from "../target-schedule/types.js";
import { bindUidLines } from "./compiler-closure.js";
import type { DomainRuntime } from "./enumerate.js";
import type { ResidualGrammar, SemanticGraph } from "./types.js";

export interface LocatedReach {
  block: number;
  lines: number[];
  nodeIds: string[];
  axes: string[];
  status: "varied" | "outside" | "undetermined";
  branchOrientation: boolean;
  outsideRegions: boolean;
  binding: "source-lines" | "all-source-returns" | "unavailable";
}
export interface ReachReport { blocks: LocatedReach[]; caveats: string[]; }
export function staleBaseline(key: readonly number[], entries: LedgerEntry[]): string | undefined {
  const winner = best(entries); if (!winner) return undefined;
  let worse = false;
  for (let i = 0; i < key.length; i++) {
    const delta = key[i]! - (winner.key[i] ?? 0);
    if (delta) { worse = delta > 0; break; }
  }
  if (!worse) return undefined;
  return `ledger best ${winner.sourcePath ?? winner.source} [${winner.key.join(", ")}] precedes this input [${key.join(", ")}]. ` +
    "This is a historical measurement, not a fresh header/context equivalence proof; inspect the better source before starting a long run.";
}
/** All serialized axes, not only the order-region list, contribute scope. */
export function grammarScope(graph: SemanticGraph, grammar: ResidualGrammar, domain?: DomainRuntime): Map<string, Set<string>> {
  const scope = new Map<string, Set<string>>();
  const add = (node: string, axis: string) => { const axes = scope.get(node) ?? new Set<string>(); axes.add(axis); scope.set(node, axes); };
  for (const region of grammar.regions) {
    const varied = !domain || domain.partitions.some(p => (p.regions.find(r => r.region.id === region.id)?.size ?? 0n) > 1n);
    if (varied) for (const node of region.nodeIds) add(node, `region:${region.id}`);
    for (const site of region.materializable) add(site.hostNodeId, `materialize:${site.siteId}`);
  }
  for (const web of grammar.webs.filter(w => grammar.partitionWebIds.includes(w.id))) {
    for (const node of [...web.defNodes, ...web.useNodes]) add(node, `web:${web.id}`);
  }
  for (const site of grammar.administrativeSites ?? []) {
    for (const node of site.redirectedReadNodes) add(node, `administrative:${site.siteId}`);
  }
  for (const site of grammar.switchFormSites ?? []) add(site.nodeId, `switch:${site.nodeId}`);
  for (const site of grammar.basePointerSites ?? []) for (const use of site.uses) add(use.nodeId, `base-pointer:${site.siteId}`);
  return scope;
}
export function reachFromLines(graph: SemanticGraph, grammar: ResidualGrammar,
  located: Array<{ block: number; lines: number[]; branchOrientation?: boolean; binding?: LocatedReach["binding"] }>, domain?: DomainRuntime): ReachReport {
  const scope = grammarScope(graph, grammar, domain);
  const blocks = located.map(item => {
    const nodes = [...new Set(item.lines.flatMap(line => {
      const matches = graph.nodes.filter(n => n.span.lineStart <= line && line <= n.span.lineEnd);
      /* A containing if's span is not proof that a statement in another arm
         belongs to this machine block. Bind to the smallest witnessed span. */
      const width = Math.min(...matches.map(n => n.span.end - n.span.start));
      return matches.filter(n => n.span.end - n.span.start === width).map(n => n.id);
    }))];
    const axes = [...new Set(nodes.flatMap(node => [...(scope.get(node) ?? [])]))].sort();
    return { block: item.block, lines: item.lines, nodeIds: nodes, axes,
      status: nodes.length === 0 ? "undetermined" as const : axes.length === 0 ? "outside" as const : "varied" as const,
      branchOrientation: item.branchOrientation ?? false,
      outsideRegions: nodes.length > 0 && !axes.some(a => a.startsWith("region:") || a.startsWith("materialize:")),
      binding: item.binding ?? (item.lines.length ? "source-lines" as const : "unavailable" as const) };
  });
  const caveats = blocks.flatMap(b => [
    ...(b.status === "outside" ? [`SEARCH REACH: located block ${b.block} (${b.binding === "all-source-returns" ? "constant-result return path; conservative union of ALL source returns, not an exact line binding" : `source lines ${b.lines.join(", ")}`}) is outside every region/axis this grammar can vary. Exhaustion does not close that block's source shapes.`] : []),
    ...(b.outsideRegions && b.status === "varied" ? [`SEARCH REACH: located block ${b.block} (${b.binding === "all-source-returns" ? "constant-result path; conservative union of ALL source returns" : `source lines ${b.lines.join(", ")}`}) is outside every statement/control region this grammar can vary. Only ${b.axes.join(", ")} touches its bound nodes; this is not coverage of return-arm construction.`] : []),
    ...(b.branchOrientation ? [`SEARCH REACH: located block ${b.block} has a branch-orientation residual. This grammar cannot add/remove return arms; measure psx_control_shape_sweep instead. Statement/web axes are not that control-shape experiment.`] : []),
    ...(b.status === "undetermined" ? [`SEARCH REACH: located block ${b.block} has no verified source-line binding; its coverage is undetermined, not certified.`] : []),
  ]);
  return { blocks, caveats };
}
export function searchReach(artifacts: ReversalArtifacts, graph: SemanticGraph, grammar: ResidualGrammar,
  analysis: TargetScheduleAnalysis, dumpDirectory: string, sourcePath: string, domain?: DomainRuntime): ReachReport {
  const lines = bindUidLines(dumpDirectory, graph.function, sourcePath);
  for (const [uid, line] of bindUidLines(dumpDirectory, graph.function, sourcePath, "dbr")) if (!lines.has(uid)) lines.set(uid, line);
  const orientations = new Set(orientationFrom(artifacts).map(f => f.block));
  const correspondence = new Map(analysis.correspondence.map(c => [c.targetIndex, c.candidateUid]));
  const located = artifacts.report.objective.blocks.filter(b => !b.blind && b.total > 0).map(b => ({
    block: b.block, branchOrientation: orientations.has(b.block),
    lines: [...new Set(artifacts.target.machine.insns.filter(i => i.block === b.block)
      .flatMap(i => { const uid = correspondence.get(i.index), line = uid === undefined ? undefined : lines.get(uid); return line === undefined ? [] : [line]; }))].sort((a, b) => a - b),
    binding: "source-lines" as LocatedReach["binding"],
  }));
  for (const item of located.filter(b => !b.lines.length)) {
    const meaningful = artifacts.target.machine.insns.filter(i => i.block === item.block && !i.isNop);
    const returnPath = meaningful.length > 0 && meaningful.every(i =>
      (i.mnemonic === "li" || i.mnemonic === "move" && i.operands[1] === "zero") && i.defs.length === 1 && i.defs[0] === "v0");
    /* No exact UID binds a literal result the candidate folded away. The union
       of ALL source return nodes is a conservative scope bound: if none is
       variable, no ambiguous choice of return node can change that conclusion. */
    if (returnPath) {
      item.lines = [...new Set(graph.nodes.filter(n => n.kind === "return").map(n => n.span.lineStart))];
      item.binding = "all-source-returns";
    } else item.binding = "unavailable";
  }
  return reachFromLines(graph, grammar, located, domain);
}
