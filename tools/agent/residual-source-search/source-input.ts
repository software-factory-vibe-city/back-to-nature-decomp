import { copyFileSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { buildTraceReportFromArtifacts, type CompilerTraceReport } from "../compilerTrace.js";
import { compareResidual, residualIsExact } from "./align.js";
import {
  assembleTarget,
  compileSource,
  configuredToolchainIdentity,
  disassembleObject,
  type CompileArtifacts,
} from "../decompToolchain.js";
import { analyzeTargetScheduleFromArtifacts } from "../target-schedule/analyze.js";
import { writeTargetScheduleArtifacts } from "../target-schedule/artifacts.js";
import { renderTargetSchedule } from "../target-schedule/render-text.js";
import type { TargetScheduleAnalysis } from "../target-schedule/types.js";
import { sha256, stableJson } from "../variant-lab/artifacts.js";
import { normalizeDisassembly, parseCc1Assembly } from "../variant-lab/compile.js";
import { findEmptyMemoryBarriers, findGeneratedGlobalDefinitions, validateVariantSource } from "../variant-lab/manifest.js";
import type { NormalizedInstruction } from "../variant-lab/types.js";
import {
  RESIDUAL_SEARCH_SCHEMA_VERSION,
  type BaselineBundle,
  type EligibilityRefusal,
  type MismatchCategory,
} from "./types.js";

export interface BaselineOptions {
  functionName: string;
  sourcePath: string;
  runRoot: string;
  /** Injected target stream (tests); otherwise assembled from the project's original assembly. */
  target?: NormalizedInstruction[];
  targetObjectPath?: string;
  maxInterventions?: number;
}

export interface BaselineResult {
  source: string;
  bundle?: BaselineBundle;
  refusal?: EligibilityRefusal;
  trace?: CompilerTraceReport;
  analysis?: TargetScheduleAnalysis;
  compile?: CompileArtifacts;
  targetObject?: string;
  /** Dump directory of the codegen-verified -g compile used only for source-line notes. */
  lineNoteDirectory?: string;
}

export function preprocessedSemanticHash(path: string): string {
  const content = readFileSync(path, "utf8")
    .split("\n")
    .filter((line) => !/^\s*#/.test(line) && line.trim().length > 0)
    .map((line) => line.trimEnd())
    .join("\n");
  return sha256(content);
}

/**
 * Deprecated positional comparison, kept only to show what it measured. The
 * target has been through the assembler and the linker and the candidate has
 * not, so comparing by position charges every stage difference to the source
 * and one inserted instruction desynchronizes the rest. Use `compareResidual`.
 */
export function mismatchedIndexes(target: NormalizedInstruction[], candidate: NormalizedInstruction[]): number[] {
  const total = Math.max(target.length, candidate.length);
  const result: number[] = [];
  for (let index = 0; index < total; index++) {
    if (target[index]?.canonical !== candidate[index]?.canonical) result.push(index);
  }
  return result;
}

/**
 * Deliverable 1: one immutable, reproducible baseline bundle. The input
 * source is never rewritten; every artifact and hash lives under runRoot.
 */
export function establishBaseline(options: BaselineOptions): BaselineResult {
  const source = readFileSync(options.sourcePath, "utf8");
  const result: BaselineResult = { source };

  if (/\bINCLUDE_ASM\s*\(/.test(source)) {
    result.refusal = {
      status: "unsupported-source",
      reason: "source still contains an INCLUDE_ASM stub",
      evidence: ["A semantic clean-C reconstruction must exist before a residual search is meaningful."],
    };
    return result;
  }
  const findings = validateVariantSource(source, {
    allowEmptyMemoryBarriers: true,
    inheritedGeneratedGlobals: findGeneratedGlobalDefinitions(source).map((definition) => definition.symbol),
  });
  if (findings.length > 0) {
    result.refusal = {
      status: "unsupported-source",
      reason: `source fails the clean-source policy: line ${findings[0]!.line}: ${findings[0]!.message}`,
      evidence: findings.map((finding) => `line ${finding.line}: ${finding.message}`),
    };
    return result;
  }

  const baselineDirectory = join(options.runRoot, "baseline");
  mkdirSync(baselineDirectory, { recursive: true });
  copyFileSync(options.sourcePath, join(options.runRoot, "input.c"));

  let compile: CompileArtifacts;
  try {
    compile = compileSource(options.sourcePath, baselineDirectory, options.functionName, { dumps: true });
  } catch (error) {
    result.refusal = {
      status: "failed",
      reason: `baseline compile failed: ${error instanceof Error ? error.message.split("\n")[0] : error}`,
      evidence: [],
    };
    return result;
  }
  result.compile = compile;

  let target: NormalizedInstruction[];
  let targetObject: string | undefined = options.targetObjectPath;
  if (options.target) target = options.target;
  else {
    try {
      targetObject = assembleTarget(options.functionName, baselineDirectory);
      target = normalizeDisassembly(disassembleObject(targetObject));
    } catch (error) {
      result.refusal = {
        status: "failed",
        reason: `target assembly unavailable: ${error instanceof Error ? error.message.split("\n")[0] : error}`,
        evidence: [],
      };
      return result;
    }
  }
  if (targetObject !== undefined) result.targetObject = targetObject;

  const candidate = parseCc1Assembly(compile.assembly);
  const residual = compareResidual(target, candidate);

  /* Diagnostic -g compile: -g adds source-line notes to the pass dumps
     without changing GCC 2.95 codegen. Note uids shift instruction uids, so
     when the -g stream is verified identical the whole diagnostic layer
     (trace, schedule analysis, line binding) reads the -g dump chain; the
     configured compile remains the authoritative candidate and flag record. */
  const caveats: string[] = [];
  const lineNoteDirectory = join(baselineDirectory, "line-notes");
  let diagnosticDumps = baselineDirectory;
  let diagnosticAssembly = compile.assembly;
  let diagnosticFlags = compile.cc1Flags;
  try {
    const lined = compileSource(options.sourcePath, lineNoteDirectory, options.functionName, {
      dumps: true,
      extraCc1Flags: ["-g"],
    });
    const linedStream = parseCc1Assembly(lined.assembly);
    const identical = linedStream.length === candidate.length &&
      linedStream.every((instruction, index) => instruction.canonical === candidate[index]!.canonical);
    if (identical) {
      diagnosticDumps = lineNoteDirectory;
      diagnosticAssembly = lined.assembly;
      diagnosticFlags = lined.cc1Flags;
      result.lineNoteDirectory = lineNoteDirectory;
    } else {
      caveats.push("the -g line-note compile changed the instruction stream; source-line binding was disabled");
    }
  } catch (error) {
    caveats.push(`line-note compile failed (${error instanceof Error ? error.message.split("\n")[0] : error}); source-line binding was disabled`);
  }

  let trace: CompilerTraceReport;
  try {
    trace = buildTraceReportFromArtifacts({
      functionName: options.functionName,
      sourcePath: options.sourcePath,
      assemblyPath: diagnosticAssembly,
      dumpDirectory: diagnosticDumps,
      outputDirectory: join(baselineDirectory, "trace"),
      flags: diagnosticFlags,
      reportFileName: "compiler-trace-report.json",
    });
  } catch (error) {
    result.refusal = {
      status: "unsupported-correspondence",
      reason: `compiler trace is not parseable: ${error instanceof Error ? error.message.split("\n")[0] : error}`,
      evidence: [],
    };
    return result;
  }
  result.trace = trace;

  let analysis: TargetScheduleAnalysis;
  try {
    analysis = analyzeTargetScheduleFromArtifacts({
      functionName: options.functionName,
      trace,
      target,
      candidate,
      outputDirectory: join(baselineDirectory, "target-schedule"),
      maxInterventions: options.maxInterventions ?? 8,
    });
    writeTargetScheduleArtifacts(join(baselineDirectory, "target-schedule"), analysis, renderTargetSchedule(analysis));
  } catch (error) {
    result.refusal = {
      status: "unsupported-correspondence",
      reason: `target-schedule analysis failed: ${error instanceof Error ? error.message.split("\n")[0] : error}`,
      evidence: [],
    };
    return result;
  }
  result.analysis = analysis;

  if (residual.assemblerFill > 0) {
    caveats.push(`${residual.assemblerFill} target instruction(s) are assembler delay-slot fills that cc1 never emits; ` +
      "they are aligned away rather than charged to the source.");
  }

  const toolchain = configuredToolchainIdentity();
  const bundle: BaselineBundle = {
    schemaVersion: RESIDUAL_SEARCH_SCHEMA_VERSION,
    function: options.functionName,
    sourcePath: options.sourcePath,
    sourceHash: sha256(source),
    preprocessedSemanticHash: preprocessedSemanticHash(compile.preprocessed),
    assemblyHash: sha256(stableJson(candidate)),
    toolchainHash: sha256(stableJson(toolchain)),
    compilerFlags: compile.cc1Flags,
    target,
    candidate,
    mismatchedTargetIndexes: residual.mismatchedTargetIndexes,
    exactInstructions: residual.exact,
    totalInstructions: residual.total,
    category: residual.category,
    emptyMemoryBarriers: findEmptyMemoryBarriers(source).length,
    traceArtifact: join(baselineDirectory, "trace", "compiler-trace-report.json"),
    analysisArtifact: join(baselineDirectory, "target-schedule", "analysis.json"),
    caveats,
  };
  result.bundle = bundle;

  if (residualIsExact(residual)) {
    result.refusal = {
      status: "exact",
      reason: "no residual source search required: the cc1 stream already matches the target",
      evidence: ["Run the exact function diff and normal finalization workflow instead."],
    };
  }
  return result;
}
