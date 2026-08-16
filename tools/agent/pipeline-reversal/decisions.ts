/**
 * Causal reduction — from located differences to independent decisions.
 *
 * A residual usually presents as many symptoms and few causes. Thirty webs in
 * the wrong register is not thirty problems: register allocation runs over the
 * sched1 order, so one value scheduled fourteen positions late displaces every
 * quantity after it. Reporting the symptoms as the search space would overstate
 * it by more than an order of magnitude and point the reader at the wrong end.
 *
 * The reduction here is deliberately conservative. It folds a block's
 * allocation differences under that block's scheduling difference only when the
 * block has one, and otherwise leaves the allocation difference standing as its
 * own decision — an allocation difference with no reordering to explain it is a
 * genuine second cause, usually an allocation-priority tie.
 */

import type { ProgramComparison } from "./compare.js";
import type { Web } from "./inverse-alloc.js";
import type { Decision, FiberSite, MirProgram } from "./types.js";

/** A moved value: the instructions that materialize it, and where they went. */
interface MovedValue {
  key: string;
  label: string;
  targetPositions: number[];
  candidatePositions: number[];
  vram: number[];
}

/**
 * Group a block's transposed instructions by the value they compute.
 *
 * A split address is two instructions and one decision; reporting them apart
 * would double-count. The grouping key is the symbol when there is one and the
 * defining web otherwise, which is the same notion the scheduler works in.
 */
function groupMoves(
  block: ProgramComparison["blocks"][number],
  target: MirProgram,
  candidate: MirProgram,
): MovedValue[] {
  const targetByIndex = new Map(target.insns.map((insn) => [insn.index, insn]));
  const candidateByIndex = new Map(candidate.insns.map((insn) => [insn.index, insn]));
  const groups = new Map<string, MovedValue>();
  for (const move of block.transposed) {
    /* A displacement the delay-slot inverse could have produced on its own is
     * not a decision. Leaving it in would send a reader — or a search — after
     * a difference between the chain and itself. */
    if (move.withinFiber) continue;
    const targetInsn = targetByIndex.get(move.target[1]);
    const candidateInsn = candidateByIndex.get(move.candidate[1]);
    if (!targetInsn || !candidateInsn) continue;
    const key = targetInsn.symbol ?? `web-${targetInsn.defWebs?.[0] ?? targetInsn.index}`;
    const group = groups.get(key) ?? {
      key,
      label: targetInsn.symbol ? `the ${targetInsn.symbol} value` : targetInsn.text,
      targetPositions: [],
      candidatePositions: [],
      vram: [],
    };
    group.targetPositions.push(move.target[0]);
    group.candidatePositions.push(move.candidate[0]);
    if (targetInsn.vram !== undefined) group.vram.push(targetInsn.vram);
    groups.set(key, group);
  }
  return [...groups.values()];
}

function averagePosition(positions: number[]): number {
  return positions.reduce((total, value) => total + value, 0) / Math.max(1, positions.length);
}

export function reduceToDecisions(
  sites: FiberSite[],
  comparison: ProgramComparison,
  target: MirProgram,
  candidate: MirProgram,
  targetWebs: Web[],
): Decision[] {
  const decisions: Decision[] = [];

  for (const site of sites) {
    if (site.kind !== "insn-population") continue;
    decisions.push({
      id: site.id,
      stage: "combine",
      location: site.location,
      summary: site.description,
      levers: ["the source computes a different set of values; no later pass can add or remove an instruction"],
      evidence: site.evidence,
      affectedVram: site.affectedVram,
      consequences: ["every allocation and scheduling reading below is provisional until the populations agree"],
    });
  }
  if (decisions.length > 0) return decisions;

  for (const copy of comparison.coalescedCopies) {
    const owner = copy.side === "target" ? target : candidate;
    const insn = owner.insns.find((entry) => entry.index === copy.insnIndex);
    const other = copy.side === "target" ? "the candidate" : "the target";
    decisions.push({
      id: `coalesce:${copy.side}:${copy.insnIndex}`,
      stage: "lreg",
      location: `block ${insn?.block ?? "?"}: ${copy.text}`,
      summary: `${other} coalesced this copy away; the ${copy.side} kept it`,
      levers: [
        "local-alloc tries the copy's hard register first (qty_phys_copy_sugg) and only fails when that register is occupied across the source value's live range",
        "the copy must therefore be scheduled outside that range at sched1 — which is a statement-order question, not a spelling one",
      ],
      evidence: [
        "the two webs the copy joins are one web on the other side",
        "jump_optimize deletes the no-op move that coalescing leaves behind, so the copy vanishes from the bytes entirely",
      ],
      affectedVram: insn?.vram === undefined ? [] : [insn.vram],
      consequences: [`instruction count differs by one (${copy.text})`],
    });
  }

  const allocationByBlock = new Map<number, FiberSite>();
  for (const site of sites) {
    if (site.kind !== "allocation-order") continue;
    const block = Number(site.id.split("block-")[1]);
    allocationByBlock.set(block, site);
  }

  const explainedBlocks = new Set<number>();
  for (const block of comparison.blocks) {
    const moves = groupMoves(block, target, candidate);
    if (moves.length === 0) continue;
    const allocation = allocationByBlock.get(block.block);
    if (allocation) explainedBlocks.add(block.block);
    for (const move of moves) {
      const delta = averagePosition(move.targetPositions) - averagePosition(move.candidatePositions);
      const direction = delta < 0 ? "earlier" : "later";
      decisions.push({
        id: `sched:${block.block}:${move.key}`,
        stage: allocation ? "sched" : "sched2",
        location: `block ${block.block}: ${move.label}`,
        summary: `the target schedules it ${Math.abs(Math.round(delta))} position(s) ${direction} (target ${move.targetPositions.join("/")}, candidate ${move.candidatePositions.join("/")})`,
        levers: [
          "RTL birth order — which statement first mentions the value, and whether a temporary is shared or inlined",
          "REG_N_SETS of the value: adjust_priority's birthing boost applies only to single-set destinations, so a second assignment changes where the value lands",
          "an added dependence: a use placed before the value's other consumers pins it",
        ],
        evidence: [
          allocation
            ? "this block's allocation also differs, so the reordering is present at sched1 — local-alloc runs before sched2 and could not otherwise see it"
            : "this block's allocation agrees, so the reordering may be sched2 alone, which allocation never observes",
        ],
        affectedVram: move.vram,
        consequences: allocation
          ? [`${allocation.members.length} value(s) in this block are then allocated differently`]
          : [],
      });
    }
  }

  for (const [block, site] of allocationByBlock) {
    if (explainedBlocks.has(block)) continue;
    decisions.push({
      id: `alloc:${block}`,
      stage: "lreg",
      location: `block ${block}`,
      summary: `${site.members.length} value(s) allocated differently with no reordering to explain it`,
      levers: [
        "the allocation order is the quantity priority order; equal priorities are broken by quantity number, which follows the sched1 birth order",
        "a value's reference count or live range — an extra use, or a use moved past a call — changes its priority directly",
      ],
      evidence: [
        "the instruction order in this block agrees, so the difference is inside local-alloc's own ranking",
        ...site.evidence,
      ],
      affectedVram: site.affectedVram,
      consequences: site.members.map((member) => member.summary),
    });
  }

  return decisions;
}
