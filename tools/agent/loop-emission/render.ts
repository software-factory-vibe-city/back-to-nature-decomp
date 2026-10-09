/**
 * render.ts — the requirement, and the candidate's standing against it.
 */

import { CLASS_NAMES, EmissionClass, type LoopEmissionRequirement, type PreheaderRequirement } from "./types.js";
import { pass2Routes } from "./derive.js";
import { assignments, emissionDistance, emissionDistanceParts, openReadings, groupName, type EmissionGoal, type PreheaderVerdict } from "./compare.js";
import type { PrecedentHit } from "./precedents.js";

function classList(classes: EmissionClass[]): string {
  return classes.length === 0 ? "NONE" : classes.map((value) => CLASS_NAMES[value]).join(" | ");
}

function renderPreheader(preheader: PreheaderRequirement): string[] {
  const lines: string[] = [];
  const where = preheader.vram === undefined ? "" : ` at 0x${preheader.vram.toString(16).toUpperCase()}`;
  lines.push(`  preheader block ${preheader.block}${where} — feeds loop header ${preheader.header}` +
    `${preheader.innerLoops.length === 0 ? "" : `, which nests loop header ${preheader.innerLoops.join(", ")}`}`);
  if (preheader.unsatisfiable) {
    lines.push("    NO CONSISTENT ASSIGNMENT. The preheader cannot be a non-decreasing sequence of");
    lines.push("    emission classes, which is a defect in this tool's model of loop.c rather than a");
    lines.push("    fact about the compiler. Report it with the groups below.");
  }
  for (const group of preheader.groups) {
    const name = group.symbol === undefined ? "" : `  ${group.symbol}`;
    const step = group.step === undefined ? "" : `  step ${group.step}`;
    lines.push(`    ${String(group.index).padStart(2)}  ${group.text}${name}${step}`);
    lines.push(`        ${group.role.padEnd(17)} -> ${classList(group.consistent)}`);
  }
  const options = assignments(preheader);
  if (options.length > 1 && options.length <= 12) {
    lines.push(`    ${options.length} consistent readings of this preheader:`);
    for (const option of options) {
      const shown = option
        .map((value, index) => (value === EmissionClass.Source ? undefined : `${index}:${CLASS_NAMES[value]}`))
        .filter(Boolean);
      /* Which mechanism a reading would need, marked on the reading itself. A
         list of class assignments is a range of coordinates; the route is what
         an agent can act on, and the cascade is the one it will not think of. */
      const cascade = preheader.groups.some((group) =>
        option[group.index] === EmissionClass.Pass2Movable
        && pass2Routes(preheader, group).some((route) => route.id === "inner-cascade"));
      lines.push(`      ${shown.length === 0 ? "nothing hoisted — every group is a source statement" : shown.join(", ")}` +
        `${cascade ? "   [reachable by the cascade route]" : ""}`);
    }
  }
  return lines;
}

export function renderRequirement(requirement: LoopEmissionRequirement): string {
  const lines: string[] = [
    `loop emission requirement ${requirement.functionName} — derived from the target's bytes`,
    "  loop.c emits into a preheader through emit_insn_before(loop_start), so the preheader",
    "  leaves read front to back as a NON-DECREASING sequence of emission classes:",
    "    source < pass-1 movable < pass-1 giv init < pass-2 movable < pass-2 giv init",
    "  Producers are no later in class than their consumers; frame operations are excluded.",
    "  Each group below admits the classes its own evidence allows; the leaf-order constraint",
    "  cuts that down. What is left is what the original's loop pass must have done.",
    "",
  ];
  for (const preheader of requirement.preheaders) {
    lines.push(...renderPreheader(preheader), "");
  }
  return lines.join("\n");
}

export function renderGoals(goals: EmissionGoal[]): string[] {
  if (goals.length === 0) {
    return [
      "GOALS",
      "  No preheader group is constrained past its own evidence. This function's loop emission",
      "  order does not pin the source beyond what the residual already says.",
    ];
  }
  const lines = ["GOALS (what the original's loop pass cannot have done in pass 1)"];
  for (const goal of goals) {
    lines.push(`  ${goal.symbol} — group ${goal.group.index}: ${goal.group.text}`);
    lines.push(goal.unconditional
      ? "    forced to a pass-2 emission by the ordering alone."
      : "    forced to a pass-2 emission in every reading where anything earlier was hoisted.");
    if (goal.routes.length > 0) {
      lines.push("    ROUTES to a pass-2 emission — these are different mechanisms, not rewordings.");
      lines.push("    A product that cannot clear the bar refutes the first only; the cascade route is");
      lines.push("    never tested at this loop's pass 1, because that scan cannot see a loop-created insn.");
      for (const route of goal.routes) {
        lines.push(`      ${route.id} — ${wrapInto(route.summary, 84).join("\n        ")}`);
        for (const line of route.evidence) lines.push(`        evidence: ${wrapInto(line, 80).join("\n                  ")}`);
        for (const line of route.requirements) lines.push(`        needs: ${wrapInto(line, 80).join("\n               ")}`);
      }
    }
  }
  return lines;
}

/** Break one long sentence into readable chunks without splitting a word. */
function wrapInto(text: string, width: number): string[] {
  return (text.match(new RegExp(`.{1,${width}}(\\s|$)`, "g")) ?? [text]).map((chunk) => chunk.trim());
}

export function renderVerdicts(verdicts: PreheaderVerdict[]): string[] {
  const lines = ["CANDIDATE (its own emission assignment, against the target's readings)"];
  for (const verdict of verdicts) {
    const where = verdict.preheader.vram === undefined
      ? `block ${verdict.preheader.block}`
      : `block ${verdict.preheader.block} at 0x${verdict.preheader.vram.toString(16).toUpperCase()}`;
    const joined = verdict.loop === undefined
      ? " — no loop in the trace could be joined to it"
      : ` (loop ${verdict.loop})`;
    const state = verdict.consistentWithTarget
      ? " — CONSISTENT with the target"
      : verdict.combinationImpossible
        ? " — every class is individually possible, but no reading holds them together"
        : "";
    lines.push(`  ${where}${joined}${state}`);
    if (verdict.given?.length) {
      lines.push(`    GIVEN ${verdict.given.join("; ")}:`);
      lines.push("      OTHER READING: the induction values are source variables, not loop-created giv inits.");
      const measurements = verdict.alternativeMeasurements ?? [];
      if (measurements.length === 0) {
        lines.push("      No fresh trace-verified ledger measurement of that reading is available; it remains open.");
      } else {
        for (const measurement of measurements) {
          lines.push(`      LEDGER ${measurement.source} (${measurement.sourceHash}): residual ${measurement.key.join("/")}; ` +
            (measurement.exact === true ? "EXACT — this alternative is witnessed" : "not exact — refutes this measured spelling only"));
        }
        lines.push("      A failed spelling does not refute the whole source-induction reading.");
      }
    }
    if (verdict.readings.length === 1 && verdict.groups.every((group) => group.outcome !== "undetermined")) {
      const reading = verdict.readings[0]!;
      const shown = reading
        .map((value, index) => (value === EmissionClass.Source ? undefined : `${index}:${CLASS_NAMES[value]}`))
        .filter(Boolean);
      lines.push(`    PINNED — exactly one reading of the target's preheader holds what this candidate did:`);
      lines.push(`      ${shown.length === 0 ? "nothing hoisted — every group is a source statement" : shown.join(", ")}`);
      /* Which mechanism that reading needs, not just which class it names. */
      const forced = verdict.preheader.groups.filter((group) =>
        reading[group.index] === EmissionClass.Pass2Movable);
      for (const group of forced) {
        const routes = pass2Routes(verdict.preheader, group).map((route) => route.id);
        lines.push(`      group ${group.index} is a pass-2 movable; routes open on this target's shape: ${routes.join(", ")}`);
      }
    } else if (verdict.readings.length > 1) {
      lines.push(`    ${verdict.readings.length} readings of the target's preheader still hold what this candidate did.`);
    }
    for (const group of verdict.groups) {
      const label = group.outcome === "met" ? "MET" : group.outcome === "not-met" ? "NOT MET" : "UNDETERMINED";
      const name = groupName(group.group);
      lines.push(`    ${label}  ${name}: candidate emits it as ${CLASS_NAMES[group.actual]}` +
        (group.outcome === "met" ? "" : `; here the target admits ${group.admissible.map((value) => CLASS_NAMES[value]).join(" or ") || "nothing"}`));
      if (group.lever) lines.push(`        ${group.lever}`);
      for (const move of group.moves ?? []) {
        const wrapped = move.match(/.{1,86}(\s|$)/g) ?? [move];
        wrapped.forEach((chunk, index) => lines.push(`        ${index === 0 ? "->" : "  "} ${chunk.trim()}`));
      }
    }
    for (const change of openReadings(verdict)) {
      const name = change.group.group.symbol ?? `0x${change.group.address.toString(16).toUpperCase()}`;
      lines.push(`    ONE CHANGE AWAY — ${name}: ${CLASS_NAMES[change.group.actual]} -> ${CLASS_NAMES[change.to]}`);
      for (const move of change.moves) {
        const wrapped = move.match(/.{1,84}(\s|$)/g) ?? [move];
        wrapped.forEach((chunk, index) => lines.push(`      ${index === 0 ? "*" : " "} ${chunk.trim()}`));
      }
    }
    if (verdict.undetermined.length > 0) {
      lines.push(`    note: ${verdict.undetermined.length} hoist(s) in this program carry no resolvable symbol`);
    }
  }
  const parts = emissionDistanceParts(verdicts);
  lines.push("");
  lines.push(`  loop-emission distance: ${emissionDistance(verdicts)}` +
    ` (${parts.failures} wrong class, ${parts.combinations} impossible combination, ${parts.undetermined} undetermined)`);
  lines.push("  Minimise this, not the byte score. On a preheader residual the byte score is flat");
  lines.push("  across the whole family of source spellings and inverted at the top of it.");
  return lines;
}

/**
 * Who already produced this, and where their C is.
 *
 * Printed above the candidate's own standing on purpose: a function in this
 * tree that already emits the order you need is worth more than any model of
 * the compiler, and it is the one thing five sessions on this residual never
 * had in front of them.
 */
export function renderPrecedents(hits: PrecedentHit[], scanned: number): string[] {
  if (hits.length === 0) {
    return [
      "PRECEDENT",
      `  None. Of ${scanned} functions scanned in this tree, none has a preheader that forces an`,
      "  emission past pass 1, so there is no worked example of this mechanism to copy. You are",
      "  deriving a spelling, not recalling one — say so in the note rather than searching further.",
    ];
  }
  const lines = [
    "PRECEDENT (functions whose own preheader already emits past pass 1)",
    "  A matched row is a spelling to copy: it matched first time, so it is absent from the",
    "  residual-signature index and shares no cluster, file or name with this function — nothing but",
    "  this key finds it. A row marked PARKED is a shape and a measured trace, not a spelling.",
  ];
  for (const hit of hits.slice(0, 3)) {
    lines.push("");
    lines.push(`  ${hit.precedent.functionName}  —  ${hit.precedent.source}` +
      `${hit.precedent.status === "parked" ? "   [PARKED]" : ""}`);
    lines.push(`    ${hit.why}`);
    if (hit.precedent.status === "parked") {
      /* The distinction has to be loud. The preheader below is the target's own
         and is as good as any matched function's; the C beside it is an attempt
         that does not reproduce it, so copying its spelling copies a failure. */
      lines.push("    ITS C DOES NOT PRODUCE THIS. The preheader is read from its target bytes, like every");
      lines.push("    other row here; the source named above is its best preserved attempt and is still");
      lines.push("    open. Take the shape and the measured trace, never the spelling.");
    }
    if (hit.sharedRoutes.length > 0) lines.push(`    routes it shares with this preheader: ${hit.sharedRoutes.join(", ")}`);
    if (hit.measuredCascade) {
      lines.push(`    MEASURED, in its own loop trace: ${hit.measuredCascade}`);
    } else if (hit.sharedRoutes.includes("inner-cascade")) {
      lines.push("    the cascade route is open on its shape; no fresh trace of its source is on disk, so");
      lines.push("    whether its compiler took that route is unmeasured here — psx_loop_trace on it says.");
    }
    hit.precedent.groups.forEach((text, index) => {
      const forced = hit.precedent.forced.includes(index);
      lines.push(`      ${forced ? "->" : "  "} ${(hit.precedent.roles[index] ?? "").padEnd(16)} ${text}`);
    });
  }
  return lines;
}
