import type {
  CompilerTraceReport,
  PseudoProvenance,
  RenderOptions,
  SchedulerDecision,
} from "./types.js";

function assigned(pseudo: PseudoProvenance): string {
  return pseudo.assignedRegister
    ? `${pseudo.assignedRegister}($${pseudo.assignedHardReg})`
    : "—";
}

function lifetime(pseudo: PseudoProvenance): string {
  if (pseudo.lifetimes.length === 0) return "—";
  return pseudo.lifetimes.map((range) =>
    `b${range.block}:${range.birthUid ?? "in"}@${range.birthIndex}-${range.deathUid ?? "out"}@${range.deathIndex}`
  ).join(",");
}

function conflictText(pseudo: PseudoProvenance): string {
  const exact = pseudo.conflicts.filter((conflict) => conflict.kind !== "fake-lifetime-only");
  const fake = pseudo.conflicts.filter((conflict) => conflict.kind === "fake-lifetime-only");
  const pieces: string[] = [];
  if (exact.length > 0) pieces.push(exact.slice(0, 8).map((conflict) =>
    conflict.registerName || String(conflict.register)
  ).join(","));
  if (fake.length > 0) pieces.push(`fake:${fake.map((conflict) => conflict.register).join(",")}`);
  return pieces.join(";") || "—";
}

function relevantDecisions(decisions: SchedulerDecision[], options: RenderOptions): SchedulerDecision[] {
  if (options.schedulerWindow) {
    return decisions.filter((decision) =>
      decision.cycle >= options.schedulerWindow!.start && decision.cycle <= options.schedulerWindow!.end
    );
  }
  const interesting = decisions.filter((decision) =>
    decision.reason === "functional-unit-hazard" ||
    decision.reason === "birth-priority" ||
    decision.reason === "blocked" ||
    decision.reason === "launch"
  );
  return interesting.slice(0, 16);
}

export function renderText(report: CompilerTraceReport, options: RenderOptions = {}): string {
  const lines: string[] = [];
  lines.push(`Compiler trace: ${report.function}`);
  lines.push(`source:    ${report.source}`);
  lines.push(`artifacts: ${report.outputDirectory}`);
  lines.push(`report:    ${report.reportArtifact}`);
  lines.push(`assembly:  ${report.assembly}`);
  lines.push("");

  lines.push("Pass summaries:");
  lines.push("  stage       insns  notes loops/depth pseudos  occurrences  dump");
  for (const stage of report.stages) {
    lines.push(
      `  ${stage.suffix.padEnd(10)} ${String(stage.instructionCount).padStart(5)}  ` +
      `${String(stage.noteCount).padStart(5)} ${`${stage.loopRegionCount}/${stage.maximumLoopDepth}`.padStart(11)} ` +
      `${String(stage.pseudoCount).padStart(7)}  ${String(stage.pseudoOccurrences).padStart(11)}  ${stage.file}`,
    );
  }

  const pseudos = options.pseudo === undefined
    ? report.pseudos
    : report.pseudos.filter((pseudo) => pseudo.pseudo === options.pseudo);
  lines.push("\nPseudo provenance and allocation:");
  if (pseudos.length === 0) {
    lines.push(options.pseudo === undefined ? "  (no pseudos found)" : `  (pseudo ${options.pseudo} not found)`);
  } else {
    lines.push("  pseudo mode flags sets/deaths assigned      pass          lifetime                    conflicts");
    for (const pseudo of pseudos) {
      const flags = [pseudo.userVariable ? "user" : "", pseudo.pointer ? "ptr" : ""].filter(Boolean).join(",") || "—";
      const deathCount = pseudo.stages.at(-1)?.deathUids.length ?? 0;
      lines.push(
        `  ${String(pseudo.pseudo).padStart(6)} ${pseudo.modes.join("/").padEnd(4)} ${flags.padEnd(8)} ` +
        `${`${pseudo.sets ?? pseudo.stages.at(-1)?.setUids.length ?? "—"}/${deathCount}`.padEnd(11)} ` +
        `${assigned(pseudo).padEnd(13)} ${(pseudo.allocationStage || "—").padEnd(13)} ` +
        `${lifetime(pseudo).slice(0, 27).padEnd(27)} ${conflictText(pseudo)}`,
      );
      if (options.pseudo !== undefined) {
        if (pseudo.sourceExpression) {
          lines.push(`         expression (${pseudo.sourceExpressionConfidence}): ${pseudo.sourceExpression}`);
        }
        for (const stage of pseudo.stages) {
          lines.push(
            `         .${stage.stage}: set[${stage.setUids}] use[${stage.useUids}] death[${stage.deathUids}] blocks[${stage.blocks}]`,
          );
        }
        for (const transition of pseudo.transitions) {
          lines.push(
            `         ${transition.fromStage}->${transition.toStage} ${transition.kind} (${transition.confidence}): ${transition.evidence}`,
          );
        }
        if (pseudo.preferences.length > 0) lines.push(`         hard-register preferences (exact): ${pseudo.preferences.join(", ")}`);
        if (pseudo.quantity) lines.push(`         quantity ${pseudo.quantity.id} (${pseudo.quantity.confidence}): ${pseudo.quantity.evidence}`);
      }
    }
  }

  lines.push("\nScheduler decisions:");
  for (const scheduler of report.schedulers) {
    const decisions = relevantDecisions(scheduler.decisions, options);
    lines.push(
      `  ${scheduler.stage}: ${Object.keys(scheduler.instructionPriorities).length} priorities, ` +
      `${scheduler.decisions.length} decisions, ${scheduler.dependencies.length} DAG edges, ` +
      `${scheduler.lifetimeChanges.filter((change) => change.direction === "shortened").length} lives shortened, ` +
      `${scheduler.lifetimeChanges.filter((change) => change.direction === "extended").length} extended`,
    );
    if (decisions.length === 0 && options.schedulerWindow) lines.push("    (no decisions in requested cycle window)");
    for (const decision of decisions) {
      lines.push(
        `    b${decision.block} T-${decision.cycle}: uid ${decision.selectedUid ?? "?"}, ` +
        `rank ${decision.selectedRank ?? "?"}, base ${decision.basePriority ?? "?"}, ` +
        `${decision.reason} (${decision.reasonConfidence}); ` +
        `ready [${decision.ready.map((entry) => `${entry.uid}:${entry.rawPriority}`).join(" ")}]`,
      );
      for (const event of decision.events.slice(0, 2)) lines.push(`      ${event}`);
    }
  }

  lines.push("\nAllocation/scheduling feedback:");
  if (report.feedback.length === 0) lines.push("  (no cross-pass findings)");
  for (const finding of report.feedback.slice(0, 24)) {
    lines.push(`  - [${finding.category}; ${finding.confidence}] ${finding.message}`);
    for (const evidence of finding.evidence.slice(0, 3)) lines.push(`      ${evidence}`);
  }

  lines.push("\nTarget register-recurrence experiments:");
  if (report.recurrenceHints.length === 0) lines.push("  (none found)");
  for (const hint of report.recurrenceHints) {
    lines.push(`  - [${hint.confidence}] ${hint.message}`);
  }

  lines.push("\nCaveats:");
  for (const caveat of report.caveats) lines.push(`  - ${caveat}`);
  return lines.join("\n");
}
