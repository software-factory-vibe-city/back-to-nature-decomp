/** Source-side desirability requirements, conditional on the measured giv inits. */
import { EmissionClass, CLASS_NAMES } from "./types.js";
import { groupIdentity, groupName, type PreheaderVerdict } from "./compare.js";
import { movableMargins, type LoopBracket, type MovableMargin } from "../loop-trace/threshold.js";
import type { LoopTrace } from "../loop-trace/types.js";
import type { LineMap } from "../loop-trace/lines.js";

export interface HoistGoal {
  block: number;
  identity: string;
  name: string;
  required: EmissionClass.Pass1Movable | EmissionClass.Pass2Movable;
}
export interface HoistAssessment {
  goal: HoistGoal;
  outcome: "met" | "not-met" | "undetermined";
  actual?: EmissionClass | undefined;
  loop?: string | undefined;
  margin?: MovableMargin | undefined;
  line?: number | undefined;
}
export interface HoistWindow {
  block: number;
  loop: string;
  after?: number | undefined;
  before: number;
  startLine?: number | undefined;
  endLine?: number | undefined;
}
export function hoistGoals(verdicts: PreheaderVerdict[]): HoistGoal[] {
  return verdicts.flatMap((verdict) => verdict.groups.flatMap((group) => {
    if (group.group.role !== "invariant" || group.outcome === "undetermined" || (group.group.consumers?.length ?? 0) > 0) return [];
    const movable = group.admissible.filter((value) => value === EmissionClass.Pass1Movable || value === EmissionClass.Pass2Movable);
    const identity = groupIdentity(group.group);
    if (movable.length !== 1 || !identity || (group.actual === EmissionClass.Source && group.admissible.includes(EmissionClass.Source))) return [];
    return [{ block: verdict.preheader.block, identity, name: groupName(group.group), required: movable[0]! as HoistGoal["required"] }];
  }));
}
export function assessHoists(
  goals: HoistGoal[], verdicts: PreheaderVerdict[], trace: LoopTrace,
  nonFixedRegs: number | undefined, brackets: LoopBracket[], lines?: LineMap,
): HoistAssessment[] {
  const margins = nonFixedRegs === undefined ? [] : movableMargins(trace, nonFixedRegs, brackets);
  return goals.map((goal) => {
    const verdict = verdicts.find((entry) => entry.preheader.block === goal.block);
    const group = verdict?.groups.find((entry) => groupIdentity(entry.group) === goal.identity);
    const loop = trace.passes.find((pass) => pass.index === 1)?.loops.find((entry) => `${entry.from}..${entry.to}` === verdict?.loop);
    /* Match via the same identity join used by the preheader comparison. */
    const candidates = loop?.movables.filter((movable) => {
      if (movable.value?.base === "constant") return goal.identity === JSON.stringify(["constant", "", movable.value.offset]);
      return group?.detail?.insn === movable.insn;
    }) ?? [];
    const insn = candidates.length === 1 ? candidates[0]!.insn : undefined;
    const margin = margins.find((entry) => entry.pass === 1 && entry.loop === verdict?.loop && entry.insn === insn);
    const outcome = !group || group.outcome === "undetermined" ? "undetermined" : group.actual === goal.required ? "met" : "not-met";
    return { goal, outcome, actual: group?.actual, loop: verdict?.loop, margin,
      line: insn === undefined ? undefined : lines?.byInsn.get(insn) };
  });
}
export function hoistWindows(assessments: HoistAssessment[]): HoistWindow[] {
  return assessments.filter((entry) => entry.goal.required === EmissionClass.Pass2Movable && entry.margin && entry.loop).map((entry) => {
    /* Assessments follow target preheader order; the window follows the log's
       loop order. Pass-created UIDs are not LUIDs, so never sort UIDs here. */
    const mustHold = assessments.filter((other) => other.goal.block === entry.goal.block && other.loop === entry.loop
      && other.goal.required === EmissionClass.Pass1Movable && other.margin && other.margin.loopOrder < entry.margin!.loopOrder)
      .sort((a, b) => a.margin!.loopOrder - b.margin!.loopOrder);
    const last = mustHold[mustHold.length - 1];
    return { block: entry.goal.block, loop: entry.loop!, after: last?.margin?.insn, before: entry.margin!.insn,
      startLine: last?.line, endLine: entry.line };
  });
}
export function renderDesirability(assessments: HoistAssessment[]): string[] {
  if (!assessments.some((entry) => entry.goal.required === EmissionClass.Pass2Movable)) return [];
  const lines = ["DESIRABILITY GOALS (counts belong to this source's pass-1 body)"];
  for (const entry of assessments) {
    const { goal, margin: m } = entry;
    lines.push(`  REQUIRED of the original: ${goal.name}: ${CLASS_NAMES[goal.required]} — ${entry.outcome.toUpperCase().replace("-", " ")}`);
    if (!m) { lines.push("    arithmetic UNDETERMINED — no uniquely attributable pass-1 comparison / threshold"); continue; }
    const decline = goal.required === EmissionClass.Pass2Movable;
    const doubling = m.movedOnce ? "2*N (moved_once)" : "N";
    const product = m.effectiveThreshold * m.actualProduct;
    lines.push(`    insn ${m.insn}: (T0 - 3*m_before(i)) * savings_i * lifetime_i ${decline ? "<" : ">="} ${doubling}`);
    lines.push(`    T0=${m.initialThreshold}, m_before=${m.decay}, savings=${m.savings}, lifetime=${m.lifetime}, moved_once=${m.movedOnce}; pass-1 N=${m.insnCount}`);
    lines.push(decline
      ? `    needs ${doubling} > ${m.effectiveThreshold}*${m.savings}*${m.lifetime} = ${product}; has N=${m.insnCount}; ${m.declineSlack > 0 ? `slack ${m.declineSlack}` : `short by ${1 - m.declineSlack}`}`
      : `    must keep ${product} >= ${doubling}; has N=${m.insnCount}; headroom ${m.moveHeadroom}${entry.outcome === "not-met" ? " — violates a must-hold goal" : ""}`);
    if (m.carriedBy) lines.push(`    WARNING: product is not the deciding disjunct (${m.carriedBy}); a desirability-only sweep cannot promise a flip`);
  }
  for (const window of hoistWindows(assessments)) {
    lines.push(`  WINDOW loop ${window.loop}: ${window.after === undefined ? "loop start" : `after insn ${window.after}`} to insn ${window.before}` +
      (window.endLine === undefined ? " (source lines unavailable)" : `; source lines ${window.startLine ?? "loop start"}..${window.endLine}`));
  }
  lines.push("  KNOBS: each moved invariant group in the window costs threshold 3 and adds its instructions to N.");
  lines.push("    Each instruction added anywhere in the pass-1 body adds 1 to N. Matching movables merge and");
  lines.push("    absorb savings/lifetime: this arithmetic is a measurement target, not a prediction.");
  lines.push("  NEXT: psx_hoist_knob_sweep measures local-copy versus direct-global accesses in/ahead of the window.");
  return lines;
}
