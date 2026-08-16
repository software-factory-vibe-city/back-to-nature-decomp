#!/usr/bin/env npx tsx
import { createHash } from "crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join, relative } from "path";
import { assembleTarget, normalizeFunctionName, resolveSource, ROOT } from "./decompToolchain.js";
import { buildDiagnosticCompiler } from "./compiler-oracle/build.js";
import { replayLocalAllocation, type LocalAllocationReplay } from "./compiler-oracle/local-allocation.js";
import { compileOracleVariant, deriveOracleInterventions, instructionComparison } from "./compiler-oracle/run.js";
import { ensureAllocatorCounterfactual } from "./compiler-oracle/ensure.js";
import type { CompilerOracleEvent, CompilerOracleInterventions, ForbiddenLocalCandidate, ForcedLocalAssignment } from "./compiler-oracle/types.js";

interface IterationResult {
  iteration: number;
  forbidden: ForbiddenLocalCandidate[];
  assignments: Array<{ pseudo: number; desired: number; observed?: number; satisfied: boolean }>;
  added: ForbiddenLocalCandidate[];
  artifactDirectory: string;
}

function usage(): never {
  console.error("Usage: npx tsx tools/agent/minimizeLocalAllocation.ts <function> [--force-build]");
  process.exit(1);
}

function rel(path: string): string {
  return relative(ROOT, path).replaceAll("\\", "/");
}

function assigned(replay: LocalAllocationReplay, pseudo: number): number | undefined {
  return replay.quantities.find((quantity) => quantity.members.includes(pseudo))?.assignedHardRegister;
}

function decidingChoice(replay: LocalAllocationReplay, pseudo: number) {
  return [...replay.decisions].reverse().find((decision) => decision.members.includes(pseudo) && decision.chosen !== undefined);
}

function key(candidate: ForbiddenLocalCandidate): string {
  return `${candidate.pseudo}:${candidate.hardRegister}`;
}

const args = process.argv.slice(2);
const name = args.find((arg) => !arg.startsWith("--"));
if (!name) usage();
const functionName = normalizeFunctionName(name);
const source = resolveSource(functionName);
/* The allocator counterfactual is produced here when it is not current for the
 * source on disk. This tool used to throw `Missing build/allocatorCounterfactual
 * /<fn>/analysis.json`, which named a path rather than the tool that writes it. */
const allocator = ensureAllocatorCounterfactual(functionName);
const derived = deriveOracleInterventions(allocator.value);
const requests = derived.forcedLocalAssignments;
const compiler = buildDiagnosticCompiler(args.includes("--force-build"));
const runId = createHash("sha256").update(JSON.stringify({
  source: createHash("sha256").update(readFileSync(source)).digest("hex"),
  compiler: compiler.buildId,
  requests,
})).digest("hex").slice(0, 16);
const output = join(ROOT, "build/localAllocationOracle", functionName, "minimizer", runId);
mkdirSync(output, { recursive: true });
const target = assembleTarget(functionName, join(output, "target"));

function compile(id: string, forbidden: ForbiddenLocalCandidate[]): { events: CompilerOracleEvent[]; object: string; directory: string } {
  const directory = join(output, id);
  const interventions: CompilerOracleInterventions = {
    scheduleEdges: [],
    forcedLocalAssignments: [],
    forbiddenLocalCandidates: forbidden,
  };
  const result = compileOracleVariant(functionName, source, compiler.compiler, directory, interventions);
  writeFileSync(join(directory, "interventions.json"), JSON.stringify(interventions, null, 2) + "\n");
  return { ...result, directory };
}

const baseline = compile("baseline", []);
const baselineReplay = replayLocalAllocation(baseline.events, requests);
if (!baselineReplay.replayVerified) throw new Error("Instrumented local allocator did not replay its stock choices");
/* A request unavailable even before candidate exclusions needs a lifetime or
   class intervention, not an allocation-choice minimizer. */
const choiceRequests = requests.filter((request) => {
  const decision = decidingChoice(baselineReplay, request.pseudo);
  return decision?.available.includes(request.hardRegister);
});
const excludedRequests = requests.filter((request) => !choiceRequests.includes(request));
const forbidden: ForbiddenLocalCandidate[] = [];
const iterations: IterationResult[] = [];
let converged = false;
let finalRun = baseline;
let finalReplay = baselineReplay;

for (let iteration = 0; iteration < 32; iteration++) {
  const run = iteration === 0 ? baseline : compile(`iteration-${iteration}`, forbidden);
  const replay = iteration === 0 ? baselineReplay : replayLocalAllocation(run.events, choiceRequests);
  const added: ForbiddenLocalCandidate[] = [];
  const assignments = choiceRequests.map((request) => {
    const observed = assigned(replay, request.pseudo);
    if (observed !== request.hardRegister) {
      const decision = decidingChoice(replay, request.pseudo);
      if (decision && decision.chosen !== undefined && decision.chosen !== request.hardRegister
          && decision.available.includes(request.hardRegister)) {
        const candidate: ForbiddenLocalCandidate = {
          pseudo: request.pseudo,
          hardRegister: decision.chosen,
          registerName: ["zero", "at", "v0", "v1", "a0", "a1", "a2", "a3", "t0", "t1", "t2", "t3", "t4", "t5", "t6", "t7", "s0", "s1", "s2", "s3", "s4", "s5", "s6", "s7", "t8", "t9", "k0", "k1", "gp", "sp", "fp", "ra"][decision.chosen],
        };
        if (!forbidden.some((item) => key(item) === key(candidate))) added.push(candidate);
      }
    }
    return { pseudo: request.pseudo, desired: request.hardRegister, observed, satisfied: observed === request.hardRegister };
  });
  iterations.push({ iteration, forbidden: [...forbidden], assignments, added, artifactDirectory: rel(run.directory) });
  finalRun = run;
  finalReplay = replay;
  if (assignments.every((item) => item.satisfied)) {
    converged = true;
    break;
  }
  if (added.length === 0) break;
  forbidden.push(...added);
}

const necessity = [];
let minimalForbidden = [...forbidden];
if (converged) {
  for (const candidate of [...forbidden]) {
    const reduced = minimalForbidden.filter((item) => key(item) !== key(candidate));
    const run = compile(`without-${candidate.pseudo}-${candidate.hardRegister}`, reduced);
    const replay = replayLocalAllocation(run.events, choiceRequests);
    const required = choiceRequests.some((request) => assigned(replay, request.pseudo) !== request.hardRegister);
    necessity.push({
      candidate,
      required,
      assignments: choiceRequests.map((request) => ({
        pseudo: request.pseudo,
        desired: request.hardRegister,
        observed: assigned(replay, request.pseudo),
      })),
      artifactDirectory: rel(run.directory),
    });
    if (!required) minimalForbidden = reduced;
  }
  const minimized = compile("minimized", minimalForbidden);
  finalRun = minimized;
  finalReplay = replayLocalAllocation(minimized.events, choiceRequests);
}
const targetComparison = instructionComparison(finalRun.object, target);
const analysis = {
  schemaVersion: 1,
  function: functionName,
  source: rel(source),
  diagnosticCompiler: rel(compiler.compiler),
  replayVerified: baselineReplay.replayVerified,
  choiceRequests,
  excludedRequests: excludedRequests.map((request: ForcedLocalAssignment) => ({
    ...request,
    reason: "The desired register is absent from the stock candidate list; this requires a lifetime/class change.",
  })),
  converged,
  exploredForbiddenCandidates: forbidden,
  minimalForbiddenCandidates: minimalForbidden,
  iterations,
  necessity,
  finalAssignments: choiceRequests.map((request) => ({
    pseudo: request.pseudo,
    desired: request.hardRegister,
    observed: assigned(finalReplay, request.pseudo),
  })),
  finalTargetComparison: targetComparison,
  caveats: [
    "Each exclusion is pseudo-local and diagnostic; it represents occupancy that clean C must create naturally, not a source solution.",
    "The greedy minimizer excludes only the currently selected register when the desired register remains legal, then verifies every exclusion by leave-one-out recompilation.",
    "Requests whose desired register is absent initially are delegated to the scheduler/lifetime oracle.",
  ],
};
writeFileSync(join(output, "analysis.json"), JSON.stringify(analysis, null, 2) + "\n");
const lines = [
  `Local-allocation minimizer: ${functionName}`,
  `stock replay: ${baselineReplay.replayedChoices}/${baselineReplay.ordinaryChoices}`,
  `converged: ${converged ? "yes" : "no"}`,
  `minimal forbidden candidates: ${minimalForbidden.map((item) => `${item.pseudo}:$${item.registerName}`).join(", ") || "none"}`,
  `target instructions at converged allocation: ${targetComparison.exact}/${targetComparison.total}`,
  "",
  ...iterations.map((iteration) => `iteration ${iteration.iteration}: ${iteration.assignments.map((item) => `${item.pseudo}=${item.observed ?? "spill"}/${item.desired}${item.satisfied ? "✓" : ""}`).join(" ")} add=${iteration.added.map((item) => `${item.pseudo}:$${item.registerName}`).join(",") || "-"}`),
  "",
  ...necessity.map((item) => `${item.candidate.pseudo}:$${item.candidate.registerName} required=${item.required ? "yes" : "no"}`),
  ...excludedRequests.map((item) => `pseudo ${item.pseudo}: desired $${item.registerName} requires lifetime/class change`),
  "",
];
writeFileSync(join(output, "summary.txt"), lines.join("\n"));
process.stdout.write(lines.join("\n"));
