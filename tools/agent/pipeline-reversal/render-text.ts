/**
 * Text rendering of a reversal report.
 *
 * The reading order is the argument: the waypoint ladder first, so the reader
 * sees which pass owns the residual before seeing any site, then the round-trip
 * checks that say how much the ladder can be trusted, then the sites.
 */

import { resolveSheet } from "../reference.js";
import { summarizeObjective } from "./objective.js";
import type { MirProgram, ReversalReport } from "./types.js";

/**
 * One block, target beside candidate, at the pre-dbr waypoint.
 *
 * The place to look when the decisions are not enough — or when the chain says
 * it is degraded and the decisions cannot be trusted. Delay slots are already
 * un-filled here, so an instruction's position is its scheduled position and
 * not an artifact of which branch it followed.
 */
export function renderBlock(target: MirProgram, candidate: MirProgram, block: number): string {
  const rows = (program: MirProgram) => {
    const byId = new Map(program.insns.map((insn) => [insn.id, insn]));
    return (program.blocks[block]?.insns ?? []).map((id) => byId.get(id)).filter(Boolean);
  };
  const left = rows(target);
  const right = rows(candidate);
  const lines: string[] = [
    `block ${block}${target.blocks[block]?.vram === undefined ? "" : ` (0x${target.blocks[block]!.vram!.toString(16).toUpperCase()})`} — pre-dbr order, delay slots un-filled`,
    "    #   target                                    candidate",
  ];
  for (let position = 0; position < Math.max(left.length, right.length); position++) {
    const one = left[position];
    const two = right[position];
    /* Shape, not text: two instructions that differ only by register are the
       same instruction differently allocated, and marking those would bury the
       positions that actually moved. */
    const mark = one?.shape === two?.shape ? " " : "*";
    lines.push(`  ${String(position).padStart(3)} ${mark} ${(one?.text ?? "").padEnd(40)} ${two?.text ?? ""}`);
  }
  lines.push("");
  lines.push("  * marks a position where the two sides hold instructions of different shape.");
  return lines.join("\n");
}

export function renderReversal(report: ReversalReport): string {
  const lines: string[] = [];
  lines.push(`pipeline reversal: ${report.functionName}`);
  lines.push(`bytes: ${report.matchedWords}/${report.totalWords} words match${report.exact ? " (exact)" : ""}`);
  lines.push(`residual: ${summarizeObjective(report.objective)}`);
  if (report.objective.undetermined > 0) {
    lines.push(`UNDETERMINED: ${report.objective.undetermined} word(s) cannot be read — resolve their relocations before trusting any residual below.`);
  }
  lines.push("");

  lines.push("WAYPOINT LADDER (oldest stage last; the residual belongs to the pass after the last agreeing stage)");
  for (const comparison of report.comparisons) {
    const mark = comparison.agrees ? "=" : "≠";
    lines.push(`  ${mark} ${comparison.stage.padEnd(8)} ${comparison.relation}`);
    lines.push(`      target ${comparison.targetCount}, candidate ${comparison.candidateCount}`);
    for (const difference of comparison.differences.slice(0, 6)) lines.push(`      ${difference}`);
  }
  lines.push("");
  lines.push(`RESIDUAL OWNER: ${report.residualOwner}`);
  if (report.firstDivergence) {
    lines.push(`  oldest disagreeing waypoint: ${report.firstDivergence.stage} (${report.firstDivergence.detail})`);
    /* Name the sheet as well as the pass. The doctrine is split by owning pass
     * precisely so a caller loads one sheet instead of the whole guide, and it
     * only works if the tool that knows the pass says which sheet that is. */
    const sheet = resolveSheet(report.firstDivergence.stage);
    if (sheet) lines.push(`  mechanism sheet: psx_reference ${sheet}`);
  }

  if (report.replay.length > 0) {
    lines.push("");
    lines.push("ROUND TRIP (each backward step replayed against the compiler's own dumps)");
    for (const check of report.replay) {
      const mark = check.status === "verified" ? "ok" : check.status === "diverged" ? "FAIL" : "n/a";
      lines.push(`  [${mark}] ${check.stage} ${check.subject}: ${check.detail}`);
    }
  }

  lines.push("");
  if (!report.exact) {
    lines.push("RESIDUAL BY BLOCK (descend this, not the byte score)");
    lines.push("  block  vram        pop  sched  alloc  copy   (suppressed)");
    for (const block of report.objective.blocks) {
      if (block.total === 0 && block.suppressed === 0) continue;
      const vram = block.vram === undefined ? "" : `0x${block.vram.toString(16).toUpperCase()}`;
      lines.push(`  ${String(block.block).padStart(5)}  ${vram.padEnd(11)} ${String(block.population).padStart(3)}  ${String(block.schedule).padStart(5)}  ${String(block.allocation).padStart(5)}  ${String(block.coalescing).padStart(4)}   ${block.suppressed > 0 ? String(block.suppressed) : ""}`);
    }
    if (report.objective.degraded) lines.push(`  DEGRADED: ${report.objective.reason}`);
  }

  lines.push("");
  if (report.decisions.length === 0) {
    lines.push("DECISIONS: none — nothing has to change.");
  } else {
    lines.push(`DECISIONS: ${report.decisions.length} independent choice(s) account for the whole residual`);

    /* The round trip is the licence for everything below it. When the backward
     * chain cannot be replayed against the compiler's own dumps, the mach
     * waypoint is partly reconstruction, and every scheduling decision derived
     * from it inherits that. Printing the failure above the list and saying
     * nothing here let a full-confidence decision list stand on a reconstruction
     * the tool had already reported as unreliable. */
    const diverged = report.replay.filter((check) => check.status === "diverged");
    if (diverged.length > 0) {
      lines.push("  PROVISIONAL: the round trip did not reproduce the compiler's own chain " +
        `(${diverged.map((check) => check.subject).join("; ")}).`);
      lines.push("  Treat the ordering decisions below as reconstructed, and confirm one against " +
        "the .sched log before spending a turn on it.");
    }

    report.decisions.forEach((decision, position) => {
      lines.push("");
      const qualifier = decision.confidence === "exact" ? "" : ` ${decision.confidence}`;
      lines.push(`  ${position + 1}. [${decision.stage}${qualifier}] ${decision.location}`);
      lines.push(`     ${decision.summary}`);
      if (decision.affectedVram.length > 0) {
        const shown = decision.affectedVram.slice(0, 6).map((vram) => `0x${vram.toString(16).toUpperCase()}`).join(" ");
        const more = decision.affectedVram.length > 6 ? ` (+${decision.affectedVram.length - 6} more)` : "";
        lines.push(`     words: ${shown}${more}`);
      }
      for (const lever of decision.levers) lines.push(`     lever: ${lever}`);
      for (const consequence of decision.consequences) lines.push(`     explains: ${consequence}`);
      for (const evidence of decision.evidence) lines.push(`     evidence: ${evidence}`);
    });
  }

  lines.push("");
  if (report.sites.length === 0) {
    lines.push("LOCATED DIFFERENCES: none — the chain inverted every stage without a residual.");
  } else {
    lines.push(`LOCATED DIFFERENCES: ${report.sites.length} site(s)`);
    for (const site of report.sites) {
      lines.push("");
      lines.push(`  [${site.stage}/${site.kind}] ${site.id} — ${site.location}`);
      lines.push(`    ${site.description}`);
      if (site.affectedVram.length > 0) {
        const shown = site.affectedVram.slice(0, 8).map((vram) => `0x${vram.toString(16).toUpperCase()}`).join(" ");
        const more = site.affectedVram.length > 8 ? ` (+${site.affectedVram.length - 8} more)` : "";
        lines.push(`    words: ${shown}${more}`);
      }
      for (const member of site.members) {
        lines.push(`    · ${member.id}: ${member.summary}`);
        for (const lever of member.sourceLever) lines.push(`        lever: ${lever}`);
      }
      for (const evidence of site.evidence) lines.push(`    evidence: ${evidence}`);
    }
  }

  if (report.ambiguities.length > 0) {
    lines.push("");
    lines.push(`CHAIN AMBIGUITIES: ${report.ambiguities.length} site(s) the inverse could not resolve to a point.`);
    lines.push("  They are applied identically to both sides, so they cancel in the comparison above");
    lines.push("  and are not part of the search space.");
    for (const site of report.ambiguities) {
      lines.push(`  · [${site.stage}/${site.kind}] ${site.location}: ${site.members.length} member(s) — ${site.description}`);
    }
  }

  if (report.caveats.length > 0) {
    lines.push("");
    lines.push("CAVEATS");
    for (const caveat of [...new Set(report.caveats)]) lines.push(`  ${caveat}`);
  }
  return lines.join("\n");
}
