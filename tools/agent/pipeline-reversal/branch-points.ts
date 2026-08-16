/**
 * Branch-point protocol.
 *
 * The output of a reversal run is not a fix; it is a finite, labeled set of
 * choices. Every site names the stage that owns the choice, where it is, what
 * the alternatives are, and — where one is known — the source-level lever that
 * selects a member. The product of the member counts is the whole remaining
 * search space, which is the number a caller should be comparing against the
 * size of the source space it would otherwise have had to enumerate.
 *
 * A site with one member is still emitted. It records a decision the chain made
 * on evidence, so a later reader can audit it instead of re-deriving it.
 */

import type { ProgramComparison, WebCorrespondence } from "./compare.js";
import type { Web } from "./inverse-alloc.js";
import type { FiberSite, MirProgram } from "./types.js";

function shapeList(bag: Map<string, number>, limit = 6): string {
  const entries = [...bag.entries()].sort((first, second) => second[1] - first[1]);
  const shown = entries.slice(0, limit).map(([shape, count]) => count > 1 ? `${count}× ${shape}` : shape);
  const more = entries.length > limit ? ` (+${entries.length - limit} more)` : "";
  return shown.join("; ") + more;
}

/**
 * Sites for a program whose instruction population differs.
 *
 * A population difference is never an allocation or scheduling question: those
 * passes rename and reorder, they do not create or destroy. The site therefore
 * belongs to the earliest stage that can change the instruction set, and the
 * only lever is the source.
 */
function populationSites(comparison: ProgramComparison): FiberSite[] {
  if (comparison.populationParity) return [];
  return [{
    id: "population",
    stage: "combine",
    location: "whole function",
    kind: "insn-population",
    description: "target and candidate do not contain the same instructions",
    members: [
      {
        id: "target-only",
        summary: comparison.targetOnlyShapes.size > 0
          ? `the target has ${shapeList(comparison.targetOnlyShapes)}`
          : "the target has no unmatched instruction",
        sourceLever: ["the source computes something the target does not, or the reverse"],
        evidence: [],
      },
      {
        id: "candidate-only",
        summary: comparison.candidateOnlyShapes.size > 0
          ? `the candidate has ${shapeList(comparison.candidateOnlyShapes)}`
          : "the candidate has no unmatched instruction",
        sourceLever: [],
        evidence: [],
      },
    ],
    affectedVram: [],
    confidence: "exact",
    evidence: [
      "instruction shapes are register-masked, so this difference survives any allocation or scheduling change",
    ],
  }];
}

/**
 * Sites for instructions that appear on both sides in a different order.
 *
 * The order at this waypoint is `sched2`'s output. Within a block it is a
 * permutation the dependence graph admits, so the fiber is characterized by a
 * constraint rather than enumerated: "this instruction must be scheduled before
 * that one".
 */
function scheduleSites(comparison: ProgramComparison, target: MirProgram, candidate: MirProgram): FiberSite[] {
  const sites: FiberSite[] = [];
  const targetByIndex = new Map(target.insns.map((insn) => [insn.index, insn]));
  const candidateByIndex = new Map(candidate.insns.map((insn) => [insn.index, insn]));
  for (const block of comparison.blocks) {
    if (block.transposed.length === 0) continue;
    const affected: number[] = [];
    for (const move of block.transposed) {
      const vram = targetByIndex.get(move.target[1])?.vram;
      if (vram !== undefined) affected.push(vram);
    }
    sites.push({
      id: `sched2:block-${block.block}`,
      stage: "sched2",
      location: `block ${block.block}`,
      kind: "schedule-order",
      description: `${block.transposed.length} instruction(s) occupy different positions in the two schedules`,
      members: block.transposed.map((move, index) => ({
        id: `move-${index}`,
        summary: move.detail,
        sourceLever: [
          "birth order at expand time (statement order, temporary spelling)",
          "REG_N_SETS of the value, which decides the birthing priority boost",
        ],
        evidence: [
          `target: ${targetByIndex.get(move.target[1])?.text ?? "?"}`,
          `candidate: ${candidateByIndex.get(move.candidate[1])?.text ?? "?"}`,
        ],
      })),
      affectedVram: affected,
      confidence: "exact",
      evidence: ["both sides hold the same instruction; only its position differs"],
    });
  }
  return sites;
}

/**
 * Sites for values the two allocators put in different registers.
 *
 * Grouped by register pair rather than by web: an allocation difference is
 * almost never independent per value — one quantity taking a register displaces
 * the next, and the group is the unit a caller can act on.
 */
function allocationSites(
  comparison: ProgramComparison,
  targetWebs: Web[],
  target: MirProgram,
): FiberSite[] {
  const differing = comparison.webs.filter((web) => !web.agrees);
  if (differing.length === 0) return [];
  const byBlock = new Map<number, WebCorrespondence[]>();
  const targetById = new Map(target.insns.map((insn) => [insn.id, insn]));
  for (const web of differing) {
    const definition = targetWebs[web.targetWeb]?.defs[0];
    const block = definition === undefined ? -1 : (targetById.get(definition)?.block ?? -1);
    const list = byBlock.get(block) ?? [];
    list.push(web);
    byBlock.set(block, list);
  }

  const sites: FiberSite[] = [];
  for (const [block, webs] of [...byBlock.entries()].sort((first, second) => first[0] - second[0])) {
    const affected: number[] = [];
    for (const web of webs) {
      for (const id of [...(targetWebs[web.targetWeb]?.defs ?? []), ...(targetWebs[web.targetWeb]?.uses ?? [])]) {
        const vram = targetById.get(id)?.vram;
        if (vram !== undefined) affected.push(vram);
      }
    }
    sites.push({
      id: `alloc:block-${block}`,
      stage: "lreg",
      location: `block ${block}`,
      kind: "allocation-order",
      description: `${webs.length} value(s) in this block were allocated to a different hard register`,
      members: webs.map((web) => ({
        id: `web-${web.targetWeb}`,
        summary: `${web.defShape}${web.symbol ? ` [${web.symbol}]` : ""} (${web.uses} use${web.uses === 1 ? "" : "s"}): target $${web.targetRegister}, candidate $${web.candidateRegister}`,
        sourceLever: [
          "the order local-alloc reaches the two quantities, which follows their birth order at sched1",
          "the quantity's reference count and lifetime, which set its allocation priority",
        ],
        evidence: [`${web.witnesses} paired instruction(s) witness this correspondence`],
      })),
      affectedVram: [...new Set(affected)].sort((first, second) => first - second),
      confidence: "exact",
      evidence: [
        "the two webs are the same value: their defining and reading instructions are paired",
        "allocation runs before sched2, so the register a value receives is decided by the sched1 order, not the order visible here",
      ],
    });
  }
  return sites;
}

/**
 * Sites for copies one side coalesced away.
 *
 * The choice belongs to local-alloc: `qty_phys_copy_sugg` records that a
 * quantity is copied to a hard register and `find_free_reg` tries that register
 * first, so the copy disappears exactly when the suggestion is admissible. It
 * is admissible when the copy's write to the hard register does not fall inside
 * the source value's live range — which is a fact about the sched1 order, not
 * about the source text directly.
 */
function coalescingSites(comparison: ProgramComparison, target: MirProgram, candidate: MirProgram): FiberSite[] {
  if (comparison.coalescedCopies.length === 0) return [];
  const targetByIndex = new Map(target.insns.map((insn) => [insn.index, insn]));
  const candidateByIndex = new Map(candidate.insns.map((insn) => [insn.index, insn]));
  return comparison.coalescedCopies.map((copy) => {
    const owner = copy.side === "target" ? targetByIndex : candidateByIndex;
    const insn = owner.get(copy.insnIndex);
    const other = copy.side === "target" ? "candidate" : "target";
    return {
      id: `coalesce:${copy.side}:${copy.insnIndex}`,
      stage: "lreg" as const,
      location: `block ${insn?.block ?? "?"}, ${copy.text}`,
      kind: "web-merge" as const,
      description: `the ${other} has no such copy: its allocator gave both ends of ${copy.text} one register, and jump_optimize deleted the resulting no-op move`,
      members: [
        {
          id: "coalesced",
          summary: `one value in ${other === "target" ? "the target" : "the candidate"}, in the copy's destination register`,
          sourceLever: [
            "the destination hard register must be free across the source value's live range at local-alloc time",
            "which means the copy must not be scheduled inside that range — a sched1 ordering fact",
          ],
          evidence: [`local-alloc's copy suggestion (qty_phys_copy_sugg) is tried first and only fails on a live-range conflict`],
        },
        {
          id: "separate",
          summary: `two values joined by ${copy.text}`,
          sourceLever: [],
          evidence: [],
        },
      ],
      affectedVram: insn?.vram === undefined ? [] : [insn.vram],
      confidence: "exact" as const,
      evidence: [
        "the two webs the copy joins are one web on the other side",
        "a register-to-register copy is never created or destroyed by the source; only allocation decides whether it survives",
      ],
    };
  });
}

export function deriveBranchPoints(
  comparison: ProgramComparison,
  target: MirProgram,
  candidate: MirProgram,
  targetWebs: Web[],
  inherited: FiberSite[],
): FiberSite[] {
  const population = populationSites(comparison);
  /* A population difference makes every later reading provisional: the two
   * programs are not the same program, so a register or a position cannot be
   * compared meaningfully yet. */
  if (population.length > 0) return [...population, ...inherited];
  return [
    ...coalescingSites(comparison, target, candidate),
    ...scheduleSites(comparison, target, candidate),
    ...allocationSites(comparison, targetWebs, target),
    ...inherited,
  ];
}

/** Product of the fiber sizes, saturating so an unbounded site is visible. */
export function searchSpaceSize(sites: FiberSite[]): number {
  let total = 1;
  for (const site of sites) {
    total *= Math.max(1, site.members.length);
    if (total > Number.MAX_SAFE_INTEGER) return Number.MAX_SAFE_INTEGER;
  }
  return total;
}
