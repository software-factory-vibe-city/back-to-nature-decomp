/**
 * The backward chain, end to end.
 *
 * bytes → g_assembler → g_dbr → g_alloc, run over the original words and over
 * the candidate object with the same code, then compared waypoint by waypoint.
 * The result is a located stage and a finite set of choices, not a fix.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { compareFunction } from "../../lib/functionOracle.js";
import { loadSymbolIndex } from "../../lib/symbolIndex.js";
import { ROOT, compileSource, normalizeFunctionName, resolveSource } from "../decompToolchain.js";
import { deriveBranchPoints, searchSpaceSize } from "./branch-points.js";
import { compareProgramsAtWaypoint, type ProgramComparison } from "./compare.js";
import { reduceToDecisions } from "./decisions.js";
import { inverseAlloc, type Web } from "./inverse-alloc.js";
import { inverseAssembler } from "./inverse-assembler.js";
import { inverseDbr } from "./inverse-dbr.js";
import { liftWords } from "./lift.js";
import { residualObjective } from "./objective.js";
import { replayPreDbr, replayWebCount } from "./replay.js";
import {
  PIPELINE_REVERSAL_SCHEMA_VERSION,
  type FiberSite,
  type MirProgram,
  type ReplayCheck,
  type ReversalReport,
  type WaypointComparison,
} from "./types.js";

export interface ReverseOptions {
  functionName: string;
  /** Candidate object; defaults to the one `make` produced. */
  objectPath?: string;
  source?: string;
  outputDirectory?: string;
  /** Compile the source with `-da` and round-trip the chain against the dumps. */
  replay?: boolean;
}

export interface ReversalArtifacts {
  report: ReversalReport;
  /** The candidate object that was read, so a caller can hash it. */
  objectPath: string;
  target: { machine: MirProgram; preDbr: MirProgram; webs: Web[] };
  candidate: { machine: MirProgram; preDbr: MirProgram; webs: Web[] };
  comparison: ProgramComparison;
}

function shapeMultisetEqual(left: MirProgram, right: MirProgram): boolean {
  if (left.insns.length !== right.insns.length) return false;
  const bag = new Map<string, number>();
  for (const insn of left.insns) bag.set(insn.shape, (bag.get(insn.shape) ?? 0) + 1);
  for (const insn of right.insns) {
    const count = bag.get(insn.shape) ?? 0;
    if (count === 0) return false;
    bag.set(insn.shape, count - 1);
  }
  return true;
}

function sameOrder(left: MirProgram, right: MirProgram): boolean {
  if (left.insns.length !== right.insns.length) return false;
  return left.insns.every((insn, index) => insn.shape === right.insns[index].shape);
}

export function reversePipeline(options: ReverseOptions): ReversalArtifacts {
  const functionName = normalizeFunctionName(options.functionName);
  const outputDirectory = options.outputDirectory ?? join(ROOT, "build/pipelineReversal", functionName);
  mkdirSync(outputDirectory, { recursive: true });

  /* A source given without an object is compiled here, which is what makes a
   * historical version of a function comparable: the residual of a source that
   * no longer exists in the tree is exactly what a backtest needs to read. */
  let objectPath = options.objectPath;
  if (!objectPath && options.source) {
    const artifacts = compileSource(options.source, join(outputDirectory, "candidate"), functionName, { assemble: true });
    objectPath = artifacts.object;
  }
  const oracle = compareFunction(functionName, objectPath ? { objectPath } : {});
  const index = loadSymbolIndex();

  const targetMachine = liftWords({ functionName, words: oracle.targetWords, index });
  const candidateMachine = liftWords({ functionName, words: oracle.candidateWords, index });

  const targetAssembler = inverseAssembler(targetMachine);
  const candidateAssembler = inverseAssembler(candidateMachine);
  const targetDbr = inverseDbr(targetAssembler.program);
  const candidateDbr = inverseDbr(candidateAssembler.program);
  const targetAlloc = inverseAlloc(targetDbr.program);
  const candidateAlloc = inverseAlloc(candidateDbr.program);

  const comparison = compareProgramsAtWaypoint(
    targetDbr.program,
    candidateDbr.program,
    targetAlloc.webs,
    candidateAlloc.webs,
  );

  const comparisons: WaypointComparison[] = [
    {
      stage: "machine",
      agrees: oracle.verdict === "match",
      relation: "byte identity",
      targetCount: targetMachine.insns.length,
      candidateCount: candidateMachine.insns.length,
      differences: oracle.verdict === "match" ? [] : [`${oracle.differing.length} differing word(s)`],
    },
    {
      stage: "dbr",
      agrees: sameOrder(targetAssembler.program, candidateAssembler.program),
      relation: "instruction shape sequence after removing assembler-inserted words",
      targetCount: targetAssembler.program.insns.length,
      candidateCount: candidateAssembler.program.insns.length,
      differences: [],
    },
    {
      stage: "mach",
      agrees: sameOrder(targetDbr.program, candidateDbr.program),
      relation: "instruction shape sequence with delay slots un-filled",
      targetCount: targetDbr.program.insns.length,
      candidateCount: candidateDbr.program.insns.length,
      differences: comparison.blocks
        .filter((block) => block.transposed.length > 0 || block.targetOnly.length > 0 || block.candidateOnly.length > 0)
        .map((block) => `block ${block.block}: ${block.transposed.length} transposed, ${block.targetOnly.length} target-only, ${block.candidateOnly.length} candidate-only`),
    },
    {
      stage: "greg",
      agrees: comparison.populationParity && comparison.orderDifferences === 0 && comparison.allocationDifferences === 0,
      relation: "value webs and their hard-register assignment",
      targetCount: targetAlloc.webs.length,
      candidateCount: candidateAlloc.webs.length,
      differences: comparison.allocationDifferences > 0
        ? [`${comparison.allocationDifferences} web(s) allocated differently`]
        : [],
    },
    {
      stage: "lreg",
      agrees: comparison.populationParity,
      relation: "instruction population under register masking",
      targetCount: targetAlloc.webs.length,
      candidateCount: candidateAlloc.webs.length,
      differences: comparison.populationParity ? [] : ["the two programs do not contain the same instructions"],
    },
  ];

  /* The ladder above is newest first, so the OLDEST disagreeing waypoint is the
   * last one that disagrees. Everything newer than it inherits that difference,
   * which is why reading the ladder from the bottom is the only way to name a
   * pass rather than a symptom. */
  const oldestDisagreeing = [...comparisons].reverse().find((entry) => !entry.agrees);
  const firstDivergence = oldestDisagreeing;
  const residualOwner = !oldestDisagreeing
    ? "none — the candidate already reproduces the target"
    : oldestDisagreeing.stage === "lreg"
      ? "expand / cse / gcse / loop / combine — the two programs do not contain the same instructions, so the source semantics differ"
      : oldestDisagreeing.stage === "greg"
        ? "local-alloc / global-alloc — the same values, allocated to different hard registers"
        : oldestDisagreeing.stage === "mach"
          ? "sched1 or sched2 — the same instructions in a different order"
          : oldestDisagreeing.stage === "dbr"
            ? "dbr_schedule — the same pre-dbr stream, different delay-slot choices"
            : "the assembler — identical instruction streams that encode differently";

  const replay: ReplayCheck[] = [];
  if (options.replay !== false) {
    try {
      const source = resolveSource(functionName, options.source);
      const artifacts = compileSource(source, join(outputDirectory, "trace"), functionName, { dumps: true });
      const input = { dumpDirectory: artifacts.outputDir, stem: `${functionName}.i` };
      replay.push(replayPreDbr(candidateDbr.program, input));
      replay.push(replayWebCount(candidateAlloc.webs.length, input));
    } catch (error) {
      replay.push({
        stage: "mach",
        subject: "forward replay",
        status: "unavailable",
        detail: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /* The chain's own ambiguities are the same construction applied to both
   * sides, so they cancel in the comparison. They are reported, but they are
   * not search space: acting on them would not change a single byte. */
  const ambiguities: FiberSite[] = [...targetDbr.sites, ...targetAssembler.sites];
  const sites = deriveBranchPoints(comparison, targetDbr.program, candidateDbr.program, targetAlloc.webs, []);
  const decisions = reduceToDecisions(sites, comparison, targetDbr.program, candidateDbr.program, targetAlloc.webs);
  const objective = residualObjective(
    functionName, comparison, targetDbr.program, candidateDbr.program,
    oracle.verdict === "match", oracle.undetermined.length);

  const report: ReversalReport = {
    schemaVersion: PIPELINE_REVERSAL_SCHEMA_VERSION,
    functionName,
    exact: oracle.verdict === "match",
    matchedWords: oracle.same,
    totalWords: oracle.same + oracle.differing.length + oracle.undetermined.length,
    comparisons,
    ...(firstDivergence ? { firstDivergence: { stage: firstDivergence.stage, detail: firstDivergence.relation } } : {}),
    residualOwner,
    replay,
    sites,
    ambiguities,
    decisions,
    objective,
    searchSpaceSize: searchSpaceSize(ambiguities),
    caveats: [
      ...(oracle.undetermined.length > 0
        ? [`${oracle.undetermined.length} word(s) are UNDETERMINED: a relocation's symbol has no known address, so neither a match nor a difference can be claimed for them`]
        : []),
      ...oracle.notes,
      ...targetMachine.caveats,
      ...targetAlloc.caveats,
      ...targetDbr.modelGaps.map((gap) => `target delay-slot model gap: ${gap}`),
      ...candidateDbr.modelGaps.map((gap) => `candidate delay-slot model gap: ${gap}`),
      ...comparison.ambiguousWebs,
    ],
  };

  writeFileSync(join(outputDirectory, "report.json"), `${JSON.stringify(report, null, 2)}\n`);

  return {
    report,
    objectPath: objectPath ?? join(ROOT, "build/src", `${functionName}.c.o`),
    target: { machine: targetMachine, preDbr: targetDbr.program, webs: targetAlloc.webs },
    candidate: { machine: candidateMachine, preDbr: candidateDbr.program, webs: candidateAlloc.webs },
    comparison,
  };
}
