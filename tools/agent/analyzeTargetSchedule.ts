#!/usr/bin/env npx tsx

import { readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { buildTraceReport } from "./compilerTrace.js";
import {
  ROOT,
  assembleTarget,
  disassembleObject,
  normalizeFunctionName,
} from "./decompToolchain.js";
import { parseRtlInstructions } from "./compiler-trace/rtl-parser.js";
import { parseCc1Assembly, normalizeDisassembly } from "./variant-lab/compile.js";
import { projectPath } from "./variant-lab/artifacts.js";
import { deriveAllocationRequirements } from "./target-schedule/allocation-requirements.js";
import { analyzeTargetOrderReplay } from "./target-schedule/counterfactual-replay.js";
import { writeTargetScheduleArtifacts } from "./target-schedule/artifacts.js";
import { analyzeDelaySlots } from "./target-schedule/delay-slot.js";
import { deriveSchedulingRequirements } from "./target-schedule/intervention-search.js";
import { alignMachineInstructions, machineRefs } from "./target-schedule/machine-alignment.js";
import { renderTargetSchedule } from "./target-schedule/render-text.js";
import { baselineSchedulerReplay, replayScheduler } from "./target-schedule/scheduler-replay.js";
import {
  attachCorrespondenceUids,
  attachFinalUids,
  attachRolePseudos,
} from "./target-schedule/uid-correspondence.js";
import {
  TARGET_SCHEDULE_SCHEMA_VERSION,
  type TargetScheduleAnalysis,
} from "./target-schedule/types.js";

interface CliOptions {
  functionName: string;
  block?: number;
  maxInterventions: number;
  json: boolean;
}

function usage(message?: string): never {
  if (message) console.error(`analyzeTargetSchedule: ${message}`);
  console.error("Usage: npx tsx tools/agent/analyzeTargetSchedule.ts <function> [--block <number>] [--max-interventions <1..8>] [--json]");
  process.exit(1);
}

function parseCli(args: string[]): CliOptions {
  if (args.length === 0) usage("missing function name");
  let functionName: string | undefined;
  let block: number | undefined;
  let maxInterventions = 3;
  let json = false;
  for (let index = 0; index < args.length; index++) {
    const argument = args[index]!;
    if (argument === "--block") {
      const raw = args[++index];
      if (!raw || !/^\d+$/.test(raw)) usage("--block requires a non-negative integer");
      block = Number(raw);
    } else if (argument === "--max-interventions") {
      const raw = args[++index];
      if (!raw || !/^\d+$/.test(raw) || Number(raw) < 1 || Number(raw) > 8) usage("--max-interventions must be 1..8");
      maxInterventions = Number(raw);
    } else if (argument === "--json") json = true;
    else if (argument.startsWith("--")) usage(`unknown option: ${argument}`);
    else if (functionName) usage("only one function may be analyzed");
    else functionName = normalizeFunctionName(argument);
  }
  if (!functionName) usage("missing function name");
  const result: CliOptions = { functionName, maxInterventions, json };
  if (block !== undefined) result.block = block;
  return result;
}

function exactRanges(target: ReturnType<typeof machineRefs>, candidate: ReturnType<typeof machineRefs>) {
  const result: Array<{ start: number; end: number; exact: boolean }> = [];
  let start: number | undefined;
  const count = Math.max(target.length, candidate.length);
  for (let index = 0; index <= count; index++) {
    const exact = index < count && target[index]?.canonical === candidate[index]?.canonical;
    if (exact && start === undefined) start = index;
    if (!exact && start !== undefined) {
      result.push({ start, end: index - 1, exact: true });
      start = undefined;
    }
  }
  return result;
}

function firstDivergence(
  target: ReturnType<typeof machineRefs>,
  candidate: ReturnType<typeof machineRefs>,
  delayRequirementIndexes: Set<number>,
  hasAllocationRequirement: boolean,
): TargetScheduleAnalysis["firstDivergence"] {
  const count = Math.max(target.length, candidate.length);
  for (let index = 0; index < count; index++) {
    if (target[index]?.canonical === candidate[index]?.canonical) continue;
    const left = target[index];
    const right = candidate[index];
    let stage: "rtl" | "sched" | "greg" | "sched2" | "dbr" = "rtl";
    if (delayRequirementIndexes.has(index)) stage = "dbr";
    else if (left && candidate.some((item) => item.canonical === left.canonical)) stage = "sched";
    else if (left?.mnemonic === right?.mnemonic && hasAllocationRequirement) stage = "greg";
    const result = {
      targetIndex: index,
      stage,
      description: `${left?.canonical ?? "<missing>"} vs ${right?.canonical ?? "<missing>"}`,
    } as NonNullable<TargetScheduleAnalysis["firstDivergence"]>;
    if (right) result.candidateIndex = right.index;
    return result;
  }
  return undefined;
}

export function analyzeTargetSchedule(options: CliOptions): TargetScheduleAnalysis {
  const trace = buildTraceReport(options.functionName);
  const traceDirectory = join(ROOT, trace.outputDirectory);
  const machStage = trace.stages.find((stage) => stage.suffix === "mach") || trace.stages.find((stage) => stage.suffix === "dbr");
  if (!machStage) throw new Error("compiler trace did not produce .mach or .dbr final RTL");
  const finalStage = machStage.suffix;
  const finalInstructions = parseRtlInstructions(readFileSync(join(ROOT, machStage.file), "utf8"), finalStage);

  const targetObject = assembleTarget(options.functionName, join(ROOT, "build/targetSchedule", options.functionName));
  const target = machineRefs(normalizeDisassembly(disassembleObject(targetObject)));
  const candidate = machineRefs(parseCc1Assembly(join(ROOT, trace.assembly)));
  const uidResult = attachFinalUids(candidate, finalInstructions);
  const alignment = alignMachineInstructions(target, candidate);
  attachCorrespondenceUids(alignment.correspondence, candidate);
  attachRolePseudos(alignment.registerRoles, trace.pseudos);

  const schedulerReplay = trace.schedulers.flatMap((scheduler) => replayScheduler(scheduler, options.block));
  const baselineReplay = trace.schedulers.flatMap((scheduler) => baselineSchedulerReplay(scheduler, options.block));
  const allocation = deriveAllocationRequirements(alignment.registerRoles, trace.pseudos, trace.allocationOrder);
  for (const requirement of allocation.requirements) {
    requirement.targetCanonical = requirement.targetIndexes.map((index) => target[index]?.canonical).filter((value): value is string => Boolean(value));
    requirement.candidateUids = requirement.candidateIndexes.map((index) => candidate[index]?.uid).filter((value): value is number => value !== undefined);
  }
  const delay = analyzeDelaySlots(target, candidate, alignment.correspondence);
  const scheduling = deriveSchedulingRequirements(
    target,
    candidate,
    alignment.correspondence,
    schedulerReplay,
    options.maxInterventions,
  ).filter((requirement) => !delay.requirements.some((delayRequirement) =>
    requirement.targetIndexes.some((index) => delayRequirement.targetIndexes.includes(index))
  ));
  for (const requirement of scheduling) {
    const related = trace.pseudos.filter((pseudo) => pseudo.stages.some((stage) =>
      [...stage.setUids, ...stage.useUids, ...stage.deathUids].some((uid) => requirement.candidateUids.includes(uid))
    ));
    requirement.pseudos = related.map((pseudo) => pseudo.pseudo);
    for (const intervention of requirement.interventions) intervention.pseudos = requirement.pseudos;
    if (requirement.interventions.length < options.maxInterventions && related.some((pseudo) => pseudo.sets === 1)) {
      requirement.interventions.push({
        id: `${requirement.id}-birth-eligibility`,
        stage: "sched",
        kind: "birth-eligibility",
        uids: requirement.candidateUids,
        pseudos: requirement.pseudos,
        expectedEffect: "toggle sched1's single-set birth-priority eligibility without changing semantics",
        sourceMechanisms: ["single-vs-multi-set", "fresh-vs-reused-web"],
        confidence: "reconstructed",
        evidence: ["At least one corresponding traced pseudo is single-set in the compiler report."],
      });
    }
    if (requirement.interventions.length < options.maxInterventions && related.length > 0) {
      requirement.interventions.push({
        id: `${requirement.id}-lifetime`,
        stage: "sched",
        kind: "lifetime-endpoint",
        uids: requirement.candidateUids,
        pseudos: requirement.pseudos,
        expectedEffect: "move a traced pseudo birth/death only within the observed independent scheduling window",
        sourceMechanisms: ["fresh-vs-reused-web", "result-vs-input-reuse", "statement-birth-order"],
        confidence: "inferred",
        evidence: ["Pseudo SET/use/death UIDs overlap the mismatching scheduling window."],
      });
    }
  }
  const targetReplay = analyzeTargetOrderReplay({
    target,
    candidate,
    correspondence: alignment.correspondence,
    scheduler: trace.schedulers.find((scheduler) => scheduler.stage === "sched") || trace.schedulers.find((scheduler) => scheduler.stage === "sched2"),
    baseline: baselineReplay,
    maxInterventions: options.maxInterventions,
  });
  for (const set of targetReplay.interventionSets) {
    for (const intervention of set.interventions) {
      const related = trace.pseudos.filter((pseudo) => pseudo.stages.some((stage) =>
        [...stage.setUids, ...stage.useUids, ...stage.deathUids].some((uid) => intervention.uids.includes(uid))
      ));
      intervention.pseudos = related.map((pseudo) => pseudo.pseudo);
    }
  }
  const requirements = [...delay.requirements, ...allocation.requirements, ...scheduling]
    .sort((left, right) => Number(right.hardConstraint) - Number(left.hardConstraint) ||
      Math.min(...left.targetIndexes) - Math.min(...right.targetIndexes) || left.id.localeCompare(right.id));
  const outputDirectory = join(ROOT, "build/targetSchedule", options.functionName);
  const delayIndexes = new Set(delay.requirements.flatMap((requirement) => requirement.targetIndexes));
  const first = firstDivergence(target, candidate, delayIndexes, allocation.allocation.length > 0);
  const analysis: TargetScheduleAnalysis = {
    schemaVersion: TARGET_SCHEDULE_SCHEMA_VERSION,
    function: options.functionName,
    source: trace.source,
    outputDirectory: projectPath(outputDirectory),
    traceArtifact: trace.reportArtifact,
    target,
    candidate,
    correspondence: alignment.correspondence,
    registerRoles: alignment.registerRoles,
    emissionAlignment: uidResult.alignment,
    machineUidLinks: uidResult.links,
    schedulerSelections: trace.schedulers.flatMap((scheduler) => scheduler.selectionExplanations),
    schedulerReplay,
    baselineReplay,
    targetOrderConstraints: targetReplay.constraints,
    targetOrderReplays: targetReplay.replays,
    interventionSets: targetReplay.interventionSets,
    allocationRequirements: allocation.allocation,
    delaySlots: delay.analyses,
    requirements,
    preservationRanges: exactRanges(target, candidate),
    caveats: [
      ...uidResult.caveats,
      "Scheduler comparator provenance models GCC 2.95.2 legacy sched.c: displayed priority, relation to the last scheduled instruction, then block-local LUID.",
      "Target-side statements are limited to observed machine order and candidate-DAG legality; target RTL dependencies are never inferred.",
      "Abstract interventions are diagnostic compiler-state hypotheses, not source edits or completion gates.",
      "Exact function/object comparison remains the oracle.",
    ],
  };
  if (first) analysis.firstDivergence = first;
  const text = renderTargetSchedule(analysis);
  writeTargetScheduleArtifacts(outputDirectory, analysis, text);
  return analysis;
}

const isCLI = process.argv[1]?.endsWith("analyzeTargetSchedule.ts");
if (isCLI) {
  try {
    const options = parseCli(process.argv.slice(2));
    const analysis = analyzeTargetSchedule(options);
    console.log(options.json ? JSON.stringify(analysis, null, 2) : renderTargetSchedule(analysis));
  } catch (error) {
    console.error(`analyzeTargetSchedule: ${error instanceof Error ? error.message : error}`);
    process.exitCode = 1;
  }
}
