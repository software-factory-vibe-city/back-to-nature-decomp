/**
 * render.ts — the report.
 *
 * The rule the layout follows: report *decision variables*, not conclusions.
 * `savings 2, life 2, moved` is a fact a reader can act on; "the hoist happened
 * in pass 1" is a fact they cannot. Everything printed here is either
 * something the pass said or arithmetic over what it said, and the arithmetic
 * carries its witness.
 */

import type { LoopRecord, LoopTrace, PreheaderLayout } from "./types.js";
import { preheaderLayouts } from "./preheader.js";
import { PHONY_CONSEQUENCE, phonyAntidote } from "./phony.js";
import { findCascades, renderCascades } from "./cascade.js";
import type { ThresholdSolution } from "./threshold.js";
import { thresholdsFor } from "./threshold.js";

function movableLine(movable: LoopTrace["passes"][number]["loops"][number]["movables"][number]): string {
  const flags = [
    movable.consec !== undefined ? `consec ${movable.consec}` : undefined,
    movable.cond ? "cond" : undefined,
    movable.force ? "force" : undefined,
    movable.global ? "global" : undefined,
    movable.done ? "done" : undefined,
    movable.moveInsn ? "move-insn" : undefined,
    movable.matches !== undefined ? `matches ${movable.matches}` : undefined,
    movable.forces !== undefined ? `forces ${movable.forces}` : undefined,
    movable.halved ? "halved" : undefined,
  ].filter(Boolean).join(" ");
  const product = movable.savings === undefined ? "" : `  savings ${movable.savings} x life ${movable.life} = ${movable.savings * movable.life}`;
  const outcome = movable.decision === "moved"
    ? `moved to ${movable.movedTo}`
    : movable.decision === "skipped" ? "no decision taken (already done)" : movable.decision;
  const name = movable.symbol === undefined ? "" : `  ${movable.symbol}`;
  return `insn ${movable.insn}  regno ${movable.regno}${name}  life ${movable.life}${product}  [${flags || "-"}]  -> ${outcome}`;
}

/**
 * A phony loop, stated as what it costs rather than as a status.
 *
 * The pass prints one quiet line for this and the tool used to echo it. It is
 * not bookkeeping: a loop that was never scanned has no decisions at all, so
 * its silence is an absence and reading it as a refusal inverts the whole
 * chain. Two variants on one function failed this way while the line sat in
 * the report.
 */
function renderPhony(loop: LoopRecord): string[] {
  const lines = [`  loop ${loop.from}..${loop.to} — PHONY: loop.c discarded it unscanned`];
  if (loop.phonyCause) {
    lines.push(`      cause: ${loop.phonyCause.detail}`);
    if (loop.phonyCause.symbols?.length) {
      lines.push(`             those insns materialise ${loop.phonyCause.symbols.join(", ")}`);
    }
  }
  for (const line of PHONY_CONSEQUENCE) lines.push(`      ${line}`);
  for (const line of phonyAntidote(loop.phonyCause)) lines.push(`      ${line}`);
  return lines;
}

function renderPreheader(layout: PreheaderLayout): string[] {
  return [
    `    preheader emission order (pass ${layout.pass})`,
    ...layout.slots.map((slot) => `      ${slot.uid === undefined ? "  ?  " : String(slot.uid).padStart(5)}  ${slot.detail}`),
  ];
}

export function renderTrace(
  trace: LoopTrace,
  solution: ThresholdSolution,
  context: { source: string; ledgerFunctions: string[]; ledgerPath: string; rejected: Array<{ loop: string; raw: string; reason: string }> },
): string {
  const lines: string[] = [];
  const layouts = preheaderLayouts(trace);
  const loops = trace.passes.reduce((total, pass) => total + pass.loops.length, 0);

  lines.push(`loop trace ${trace.functionName} — ${trace.passes.length} pass${trace.passes.length === 1 ? "" : "es"}, ${loops} loop record${loops === 1 ? "" : "s"}`);
  lines.push(`  source: ${context.source}`);
  lines.push("  CANDIDATE-SIDE. This is what THIS program's loop pass decided. There is no");
  lines.push("  loop dump for a binary nobody compiled, so nothing here is a reading of the");
  lines.push("  target; the residual is what says how the original's decisions differed.");

  for (const pass of trace.passes) {
    lines.push("", `PASS ${pass.index}`);
    for (const loop of pass.loops) {
      lines.push("");
      if (loop.phony) { lines.push(...renderPhony(loop)); continue; }
      if (loop.ignored) { lines.push(`  loop at ${loop.from} — ignored: ${loop.ignored}`); continue; }
      lines.push(`  loop ${loop.from}..${loop.to} — ${loop.insnCount} real insns${loop.continueAt === undefined ? "" : `, continue at ${loop.continueAt}`}`);

      if (loop.movables.length > 0) {
        lines.push("    movables");
        for (const movable of loop.movables) lines.push(`      ${movableLine(movable)}`);
      }

      const layout = layouts.find((entry) => entry.pass === pass.index && entry.from === loop.from && entry.to === loop.to);
      if (layout) lines.push(...renderPreheader(layout));

      if (loop.bivs.length > 0) {
        lines.push("    basic induction variables");
        for (const biv of loop.bivs) {
          const state = [
            biv.verified ? "verified" : undefined,
            biv.discarded ? `discarded (${biv.discarded})` : undefined,
            biv.eliminated ? "eliminated" : undefined,
            biv.eliminable === true ? "can be eliminated" : biv.eliminable === false ? "cannot be eliminated" : undefined,
            biv.cannotEliminate ? `kept${biv.cannotEliminate.usedIn === undefined ? "" : ` (used in insn ${biv.cannotEliminate.usedIn})`}` : undefined,
          ].filter(Boolean).join(", ");
          const init = biv.initInsn === undefined ? "" : `  init at insn ${biv.initInsn} = ${biv.initialValue}`;
          lines.push(`      reg ${biv.regno}  step ${biv.increment ?? "?"}  ${state}${init}  [proposed at ${biv.candidates.join(", ") || "-"}]`);
        }
      }

      if (loop.givs.length > 0) {
        lines.push("    general induction variables");
        for (const giv of loop.givs) {
          const identity = giv.destAddress ? "dest address" : `reg ${giv.reg}`;
          const form = `mult ${giv.mult ?? "?"}${giv.add === undefined ? "" : ` add ${giv.add}`}`;
          const chain = [
            giv.combinedWith !== undefined ? `combined with ${giv.combinedWith}` : undefined,
            giv.recombinedWith ? `recombined with ${giv.recombinedWith.insn} as ${giv.recombinedWith.as}` : undefined,
            giv.derivedFrom ? `derived from ${giv.derivedFrom.insn} as ${giv.derivedFrom.as}` : undefined,
            giv.reducedTo ? `reduced to ${giv.reducedTo}` : undefined,
            giv.rejected ? `NOT REDUCED — not worth while, ${giv.rejected.product} vs ${giv.rejected.insnCount}` : undefined,
            giv.needsMultiply ? "NOT REDUCED — would need a multiply" : undefined,
            giv.finalValueReplaceable ? "final value replaceable" : undefined,
          ].filter(Boolean).join("; ");
          const name = giv.symbol === undefined ? "" : `  ${giv.symbol}`;
          lines.push(`      insn ${giv.insn}  ${identity}${name}  src biv ${giv.srcReg}  benefit ${giv.benefit}  lifetime ${giv.lifetime}  ${form}${giv.replaceable ? "  replaceable" : ""}${giv.ncav ? "  ncav" : ""}`);
          if (chain) lines.push(`        ${chain}`);
        }
      }

      for (const note of loop.notes) lines.push(`    | ${note}`);
    }
  }

  const cascades = renderCascades(findCascades(trace));
  if (cascades.length > 0) lines.push("", ...cascades);

  lines.push("", ...renderThreshold(solution, context));

  if (context.rejected.length > 0) {
    lines.push("", "DECISIONS DELIBERATELY NOT USED AS EVIDENCE");
    lines.push("  move_movables moves on a four-way disjunction, so a move only bounds the");
    lines.push("  threshold when no other clause could have carried it.");
    for (const entry of context.rejected) lines.push(`    loop ${entry.loop}: ${entry.raw}\n      -> ${entry.reason}`);
  }

  if (trace.unrecognised.length > 0) {
    lines.push("", "UNRECOGNISED LOG LINES (the grammar did not cover these — report them)");
    for (const entry of trace.unrecognised) lines.push(`  line ${entry.line}: ${entry.text}`);
  }

  return lines.join("\n");
}

export function renderThreshold(
  solution: ThresholdSolution,
  context: { ledgerFunctions: string[]; ledgerPath: string },
): string[] {
  const lines: string[] = ["THRESHOLD (loop.c never prints it; solved from the decisions)"];
  if (solution.constraintCount === 0) {
    lines.push("  no sound constraint on record — no traced loop has yet made a desirability");
    lines.push("  decision that the four-way disjunction leaves attributable to the threshold.");
    return lines;
  }
  if (!solution.consistent) {
    lines.push("  NO VALUE SATISFIES EVERY CONSTRAINT. That is a defect in this tool's model of");
    lines.push("  loop.c, not a fact about the compiler. Report it with the brackets below.");
  } else if (solution.candidates.length === 1) {
    const n = solution.candidates[0]!;
    const t = thresholdsFor(n);
    lines.push(`  n_non_fixed_regs = ${n}  (unique over ${solution.constraintCount} constraint${solution.constraintCount === 1 ? "" : "s"} from ${context.ledgerFunctions.length} function${context.ledgerFunctions.length === 1 ? "" : "s"})`);
    lines.push(`    move_movables    threshold = ${t.moveWithCall} in a loop with a call, ${t.moveWithoutCall} without`);
    lines.push(`    strength_reduce  threshold = ${t.reduceWithCall} in a loop with a call, ${t.reduceWithoutCall} without`);
    lines.push("    and move_movables takes 3 off its own threshold after every movable it moves.");
  } else {
    const low = solution.candidates[0]!;
    const high = solution.candidates[solution.candidates.length - 1]!;
    lines.push(`  n_non_fixed_regs in {${solution.candidates.length > 8 ? `${low}..${high}` : solution.candidates.join(", ")}}  (${solution.constraintCount} constraints from ${context.ledgerFunctions.length} function${context.ledgerFunctions.length === 1 ? "" : "s"})`);
    lines.push(`    move_movables    threshold in ${thresholdsFor(low).moveWithCall}..${thresholdsFor(high).moveWithoutCall}`);
    lines.push("    trace another function with loops to narrow it.");
  }

  lines.push("  witnesses");
  for (const bracket of solution.brackets) {
    const parts: string[] = [];
    if (bracket.lower) parts.push(`threshold >= ${bracket.lower.value}`);
    if (bracket.upper) parts.push(`threshold <= ${bracket.upper.value}`);
    if (parts.length > 0) {
      lines.push(`    ${bracket.function} pass ${bracket.pass} loop ${bracket.loop}: ${parts.join(", ")}`);
      if (bracket.lower) lines.push(`      >= from  ${bracket.lower.witness}`);
      if (bracket.upper) lines.push(`      <= from  ${bracket.upper.witness}`);
    }
    for (const divisor of bracket.divisors) {
      lines.push(`    ${bracket.function} pass ${bracket.pass} loop ${bracket.loop}: strength_reduce threshold divides ${divisor.value}`);
      lines.push(`      from  ${divisor.witness}`);
    }
  }
  lines.push(`  running record: ${context.ledgerPath} (${context.ledgerFunctions.join(", ")})`);
  return lines;
}
