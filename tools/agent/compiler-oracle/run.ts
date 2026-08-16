import { execFileSync } from "child_process";
import { createHash } from "crypto";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "fs";
import { basename, join, relative } from "path";
import {
  AS_FLAGS,
  CC1_FLAGS,
  CPP_FLAGS,
  ROOT,
  assembleCompilerOutput,
  assembleTarget,
  compileSource,
  configuredCompilerPath,
  disassembleObject,
  loadFlagOverrides,
  resolveSource,
} from "../decompToolchain.js";
import type { AllocatorCounterfactualAnalysis } from "../allocator-counterfactual/types.js";
import { buildDiagnosticCompiler } from "./build.js";
import {
  COMPILER_ORACLE_SCHEMA_VERSION,
  type CompilerOracleEvent,
  type CompilerOracleInterventions,
  type CompilerOracleReport,
  type CompilerOracleVariantResult,
  type ForcedLocalAssignment,
} from "./types.js";

const HARD_REGISTERS = [
  "zero", "at", "v0", "v1", "a0", "a1", "a2", "a3",
  "t0", "t1", "t2", "t3", "t4", "t5", "t6", "t7",
  "s0", "s1", "s2", "s3", "s4", "s5", "s6", "s7",
  "t8", "t9", "k0", "k1", "gp", "sp", "fp", "ra",
];

function sha256File(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function relativePath(path: string): string {
  return relative(ROOT, path).replaceAll("\\", "/");
}

function uniqueBy<T>(values: T[], key: (value: T) => string): T[] {
  const result: T[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    const id = key(value);
    if (seen.has(id)) continue;
    seen.add(id);
    result.push(value);
  }
  return result;
}

export function deriveOracleInterventions(analysis: AllocatorCounterfactualAnalysis): CompilerOracleInterventions {
  const scheduleEdges = uniqueBy(
    analysis.roles.flatMap((role) => role.findings.flatMap((finding) =>
      finding.explicitHardBlockers.flatMap((blocker) => blocker.requiredRelation ? [blocker.requiredRelation] : [])
    )),
    (edge) => `${edge.beforeUid}<${edge.afterUid}`,
  );
  const forcedLocalAssignments = uniqueBy(
    analysis.roles.flatMap((role) => role.findings.flatMap((finding) => {
      if (finding.allocationStage !== "local" || finding.observedRegister === finding.desiredRegister) return [];
      const hardRegister = HARD_REGISTERS.indexOf(finding.desiredRegister);
      if (hardRegister < 0) return [];
      return [{ pseudo: finding.pseudo, hardRegister, registerName: finding.desiredRegister }];
    })),
    (assignment) => `${assignment.pseudo}:${assignment.hardRegister}`,
  );
  return { scheduleEdges, forcedLocalAssignments, forbiddenLocalCandidates: [] };
}

export function parseOracleEvents(content: string): CompilerOracleEvent[] {
  const result: CompilerOracleEvent[] = [];
  for (const [index, line] of content.split("\n").entries()) {
    if (!line.trim()) continue;
    try {
      const event = JSON.parse(line) as CompilerOracleEvent;
      if ((event.stage !== "sched" && event.stage !== "local") || typeof event.event !== "string") {
        throw new Error("missing stage/event");
      }
      result.push(event);
    } catch (error) {
      throw new Error(`Invalid compiler-oracle JSONL line ${index + 1}: ${String(error)}: ${line}`);
    }
  }
  return result;
}

function canonicalInstruction(instruction: ReturnType<typeof disassembleObject>[number]): string {
  const relocation = instruction.relocation ? `|${instruction.relocation.type}:${instruction.relocation.symbol}` : "";
  return `${instruction.mnemonic} ${instruction.operands.join(",")}${relocation}`;
}

export function instructionComparison(leftObject: string, rightObject: string): { exact: number; total: number; same: boolean } {
  const left = disassembleObject(leftObject).map(canonicalInstruction);
  const right = disassembleObject(rightObject).map(canonicalInstruction);
  let exact = 0;
  for (let index = 0; index < Math.min(left.length, right.length); index++) {
    if (left[index] === right[index]) exact++;
  }
  return { exact, total: right.length, same: left.length === right.length && exact === right.length };
}

function runCc1(
  compiler: string,
  preprocessed: string,
  assembly: string,
  cwd: string,
  flags: string[],
  environment: Record<string, string>,
): void {
  try {
    execFileSync(compiler, [...flags, basename(preprocessed), "-o", basename(assembly)], {
      cwd,
      env: { ...process.env, ...environment },
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      maxBuffer: 64 * 1024 * 1024,
    });
  } catch (error: any) {
    const detail = Buffer.isBuffer(error?.stderr) ? error.stderr.toString() : String(error?.stderr || error?.message || error);
    throw new Error(`Diagnostic cc1 failed: ${detail.trim()}`);
  }
}

export function compileOracleVariant(
  functionName: string,
  source: string,
  compiler: string,
  directory: string,
  interventions: CompilerOracleInterventions,
): { object: string; events: CompilerOracleEvent[] } {
  mkdirSync(directory, { recursive: true });
  const stem = functionName;
  const preprocessed = join(directory, `${stem}.i`);
  const assembly = join(directory, `${stem}.s`);
  const object = join(directory, `${stem}.c.o`);
  const log = join(directory, "events.jsonl");
  if (existsSync(log)) rmSync(log);
  execFileSync("mips-linux-gnu-cpp", [...CPP_FLAGS, source, "-o", preprocessed], {
    cwd: ROOT, stdio: ["ignore", "pipe", "pipe"], maxBuffer: 64 * 1024 * 1024,
  });
  const overrides = loadFlagOverrides().get(stem) || [];
  const flags = [...CC1_FLAGS, ...overrides, "-da"];
  const environment: Record<string, string> = { PSX_ORACLE_LOG: log };
  if (interventions.scheduleEdges.length > 0) {
    environment.PSX_ORACLE_SCHEDULE_EDGES = interventions.scheduleEdges
      .map((edge) => `${edge.beforeUid}<${edge.afterUid}`).join(",");
  }
  if (interventions.forcedLocalAssignments.length > 0) {
    environment.PSX_ORACLE_FORCE_LOCAL = interventions.forcedLocalAssignments
      .map((assignment) => `${assignment.pseudo}:${assignment.hardRegister}`).join(",");
  }
  if (interventions.forbiddenLocalCandidates.length > 0) {
    environment.PSX_ORACLE_FORBID_LOCAL = interventions.forbiddenLocalCandidates
      .map((assignment) => `${assignment.pseudo}:${assignment.hardRegister}`).join(",");
  }
  runCc1(compiler, preprocessed, assembly, directory, flags, environment);
  assembleCompilerOutput(assembly, object);
  return { object, events: parseOracleEvents(existsSync(log) ? readFileSync(log, "utf8") : "") };
}

function variantMatrix(interventions: CompilerOracleInterventions): Array<{ id: string; interventions: CompilerOracleInterventions }> {
  const empty = (): CompilerOracleInterventions => ({ scheduleEdges: [], forcedLocalAssignments: [], forbiddenLocalCandidates: [] });
  const result = [
    { id: "baseline", interventions: empty() },
    { id: "schedule-only", interventions: { scheduleEdges: interventions.scheduleEdges, forcedLocalAssignments: [], forbiddenLocalCandidates: [] } },
    { id: "local-only", interventions: { scheduleEdges: [], forcedLocalAssignments: interventions.forcedLocalAssignments, forbiddenLocalCandidates: [] } },
    { id: "combined", interventions },
  ];
  for (const edge of interventions.scheduleEdges) {
    result.push({
      id: `combined-without-edge-${edge.beforeUid}-${edge.afterUid}`,
      interventions: {
        scheduleEdges: interventions.scheduleEdges.filter((candidate) => candidate !== edge),
        forcedLocalAssignments: interventions.forcedLocalAssignments,
        forbiddenLocalCandidates: interventions.forbiddenLocalCandidates,
      },
    });
  }
  for (const assignment of interventions.forcedLocalAssignments) {
    result.push({
      id: `combined-without-local-${assignment.pseudo}-${assignment.hardRegister}`,
      interventions: {
        scheduleEdges: interventions.scheduleEdges,
        forcedLocalAssignments: interventions.forcedLocalAssignments.filter((candidate) => candidate !== assignment),
        forbiddenLocalCandidates: interventions.forbiddenLocalCandidates,
      },
    });
  }
  return uniqueBy(result, (item) => JSON.stringify(item.interventions));
}

function acceptedAssignments(events: CompilerOracleEvent[]): ForcedLocalAssignment[] {
  return uniqueBy(events.filter((event) => event.stage === "local" && event.event === "force_accept")
    .flatMap((event) => (event.members || []).map((pseudo) => ({
      pseudo,
      hardRegister: event.hardRegister!,
      registerName: HARD_REGISTERS[event.hardRegister!],
    }))), (item) => `${item.pseudo}:${item.hardRegister}`);
}

function rejectedAssignments(events: CompilerOracleEvent[]): ForcedLocalAssignment[] {
  return uniqueBy(events.filter((event) => event.stage === "local" && event.event === "force_reject")
    .flatMap((event) => (event.members || []).map((pseudo) => ({
      pseudo,
      hardRegister: event.hardRegister!,
      registerName: HARD_REGISTERS[event.hardRegister!],
    }))), (item) => `${item.pseudo}:${item.hardRegister}`);
}

export function runCompilerOracle(
  functionName: string,
  options: { forceBuild?: boolean; analysis?: AllocatorCounterfactualAnalysis } = {},
): CompilerOracleReport {
  const source = resolveSource(functionName);
  const analysisPath = join(ROOT, "build/allocatorCounterfactual", functionName, "analysis.json");
  /* Callers reach this through `ensureCompilerOracleReport`, which produces the
   * allocator counterfactual and hands it over. The file read is the fallback
   * for a direct call; neither path asks the caller to run a tool first. */
  const analysis = options.analysis ?? (() => {
    if (!existsSync(analysisPath)) {
      throw new Error(`Allocator analysis not found: ${relativePath(analysisPath)}`);
    }
    return JSON.parse(readFileSync(analysisPath, "utf8")) as AllocatorCounterfactualAnalysis;
  })();
  const interventions = deriveOracleInterventions(analysis);
  const diagnostic = buildDiagnosticCompiler(options.forceBuild);
  const productionCompiler = configuredCompilerPath();
  const runId = createHash("sha256").update(JSON.stringify({
    source: sha256File(source), compiler: sha256File(diagnostic.compiler), interventions,
  })).digest("hex").slice(0, 16);
  const runDirectory = join(ROOT, "build/compilerOracle/runs", functionName, runId);
  mkdirSync(runDirectory, { recursive: true });

  const production = compileSource(source, join(runDirectory, "production"), functionName, { dumps: true, assemble: true });
  const targetObject = assembleTarget(functionName, join(runDirectory, "target"));
  const variants: CompilerOracleVariantResult[] = [];
  let baselineProductionEquivalent = false;

  for (const item of variantMatrix(interventions)) {
    const artifactDirectory = join(runDirectory, item.id);
    const result: CompilerOracleVariantResult = {
      id: item.id,
      interventions: item.interventions,
      compiled: false,
      exactObject: false,
      eventCount: 0,
      scheduleOverrideCount: 0,
      scheduleEdgeInjectionCount: 0,
      forcedLocalAccepted: [],
      forcedLocalRejected: [],
      artifactDirectory: relativePath(artifactDirectory),
    };
    try {
      const compiled = compileOracleVariant(functionName, source, diagnostic.compiler, artifactDirectory, item.interventions);
      const targetComparison = instructionComparison(compiled.object, targetObject);
      const productionComparison = instructionComparison(compiled.object, production.object!);
      result.compiled = true;
      result.instructionCount = disassembleObject(compiled.object).length;
      result.exactInstructionCount = targetComparison.exact;
      result.maskedMatchPercent = targetComparison.total === 0 ? 0 : targetComparison.exact / targetComparison.total * 100;
      result.exactObject = targetComparison.same;
      result.productionEquivalent = productionComparison.same;
      result.eventCount = compiled.events.length;
      result.scheduleOverrideCount = compiled.events.filter((event) => event.event === "rank_override").length;
      result.scheduleEdgeInjectionCount = compiled.events.filter((event) => event.event === "edge_inject" && event.legal === 1).length;
      result.forcedLocalAccepted = acceptedAssignments(compiled.events);
      result.forcedLocalRejected = rejectedAssignments(compiled.events);
      if (item.id === "baseline") baselineProductionEquivalent = productionComparison.same;
      writeFileSync(join(artifactDirectory, "interventions.json"), JSON.stringify(item.interventions, null, 2) + "\n");
    } catch (error) {
      result.error = String(error);
    }
    variants.push(result);
  }

  const report: CompilerOracleReport = {
    schemaVersion: COMPILER_ORACLE_SCHEMA_VERSION,
    function: functionName,
    source: relativePath(source),
    runDirectory: relativePath(runDirectory),
    diagnosticCompiler: relativePath(diagnostic.compiler),
    diagnosticCompilerSha256: sha256File(diagnostic.compiler),
    productionCompilerSha256: sha256File(productionCompiler),
    baselineProductionEquivalent,
    derivedInterventions: interventions,
    variants,
    caveats: [
      "The diagnostic compiler is never used by the production build and generated candidates are never promoted.",
      "A scheduler edge changes only ready-list pair ranking when both UIDs are simultaneously ready; an absent override is evidence that ranking alone cannot realize the relation.",
      "A forced local assignment is accepted only if the stock local allocator's complete hard-register exclusion set considers it legal over the quantity lifetime.",
      "Instruction equality here includes exact operands and relocation annotations; make check remains the final project oracle.",
    ],
  };
  writeFileSync(join(runDirectory, "report.json"), JSON.stringify(report, null, 2) + "\n");
  writeFileSync(join(runDirectory, "summary.txt"), renderCompilerOracleReport(report));
  return report;
}

export function renderCompilerOracleReport(report: CompilerOracleReport): string {
  const lines = [
    `Compiler counterfactual oracle: ${report.function}`,
    `baseline diagnostic == production: ${report.baselineProductionEquivalent ? "yes" : "NO"}`,
    `schedule edges: ${report.derivedInterventions.scheduleEdges.map((edge) => `${edge.beforeUid}<${edge.afterUid}`).join(", ") || "none"}`,
    `forced locals: ${report.derivedInterventions.forcedLocalAssignments.map((item) => `${item.pseudo}:$${item.registerName || item.hardRegister}`).join(", ") || "none"}`,
    "",
  ];
  for (const variant of report.variants) {
    const score = variant.compiled ? `${variant.exactInstructionCount}/${variant.instructionCount}` : "compile failed";
    lines.push(`${variant.id.padEnd(38)} ${score.padEnd(12)} exact=${variant.exactObject ? "yes" : "no"} edges=${variant.scheduleEdgeInjectionCount} overrides=${variant.scheduleOverrideCount} accepted=${variant.forcedLocalAccepted.map((item) => `${item.pseudo}:$${item.registerName}`).join(",") || "-"}`);
    if (variant.error) lines.push(`  ${variant.error}`);
  }
  lines.push("", ...report.caveats.map((item) => `- ${item}`), "");
  return lines.join("\n");
}
