/**
 * The reconstruction engine: original bytes in, exact candidate bundle or an
 * explicitly scoped unresolved result out (plan §1).
 *
 * The generator reads target-side artifacts only — the container image, splat
 * configs, and symbol tables. It never opens `src/`, never reads project type
 * headers, and never edits live sources; candidates compile inside an isolated
 * bundle under `build/matchingReconstruction/`. An umbrella-context candidate
 * does include the project's umbrella header at *compile* time, which is warm
 * project context; the bundle records which context mode every candidate used
 * so a source-hidden evaluation can tell the difference.
 *
 * Supported classes, routed by the recovered decision DAG's shape:
 *   - a single leaf: straight-line effects (stores in machine order + return);
 *   - a test DAG with pure leaves: the fixed-bound record scan.
 * Anything else reports the blocking evidence, never a guess.
 *
 * Three contract rules this file is the enforcement point for:
 *
 *   1. **Effective flags.** Candidates compile under the flag set the
 *      production build would use for this translation unit, per-file
 *      overrides included. Compiling a matching campaign with overrides
 *      disabled makes it a different experiment from the build it is trying
 *      to reproduce. Selecting a *new* override is still forbidden — this
 *      applies what `configs/flag_overrides.mk` already records.
 *   2. **Best effort is kept on every stop.** A budget stop is the case most
 *      likely to have produced a useful draft, and it was the one case that
 *      threw it away.
 *   3. **Everything written is manifested.** Files are produced through an
 *      `ArtifactRecorder`, so a consumer can tell this run's winner from a
 *      previous run's leftover.
 */

import { readFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import {
  ROOT,
  compileSource,
  configuredCc1FlagsForContainer,
  detectImplicitDeclarations,
  loadFlagOverrides,
  rejectionFromDiagnostics,
} from "../decompToolchain.js";
import { containerTargetPath, loadContainer, vramToRom } from "../../lib/container.js";
import { requireFunctionLocation, loadSymbolIndex, resolveAddress } from "../../lib/symbolIndex.js";
import { compareFunction } from "../../lib/functionOracle.js";
import { computeProvenance, stamped, writeStableJson } from "../provenance.js";
import { decodeBytes, executeFunction, UnsupportedTarget } from "./exec.js";
import { fitScanRelation, describeRelation } from "./scan-relation.js";
import { ensureAccessIndex, deriveOrigins } from "./access-index.js";
import { constructCandidate, enumerateChoices } from "./construct.js";
import { constructEffectCandidates, constructGuardedCandidates, fitStraightLineEffects } from "./effect-construct.js";
import { constructControlFlowCandidates } from "./control-structure.js";
import { targetFeatures, type FailureCategory } from "./failure-category.js";
import { recoverContextFrom, renderContext, type RecoveredContext } from "./context-product.js";
import { ArtifactRecorder } from "./result-contract.js";
import { contextMode, describeContextMode, warmContextAllowed } from "./context-mode.js";
import { stableJson } from "../provenance.js";
import {
  MATCHING_RECONSTRUCTION_SCHEMA_VERSION,
  type CandidateOutcome,
  type ConstructionChoice,
  type PartialFacts,
  type ResultBundle,
} from "./types.js";

export interface ReconstructOptions {
  functionName: string;
  /** Defaults to `build/matchingReconstruction/<function>`. */
  outputDirectory?: string | undefined;
  /** Compile budget. The default evaluates the whole bounded domain. */
  maxCandidates?: number | undefined;
  /** Evaluate every candidate even after an exact match. */
  exhaustive?: boolean | undefined;
  /**
   * Compile without this translation unit's per-file flag overrides. Off by
   * default: the campaign must reproduce the production build. Set only to
   * measure what an override is worth.
   */
  ignoreFlagOverrides?: boolean | undefined;
  notify?: ((line: string) => void) | undefined;
}

const choiceId = (index: number, choice: ConstructionChoice): string => {
  const origin = choice.origin.kind === "standalone" ? "standalone" : `embedded+0x${choice.origin.offset.toString(16)}`;
  return [
    String(index).padStart(3, "0"),
    origin,
    choice.layout.kind,
    choice.loop,
    choice.result,
    choice.condition,
    choice.context,
  ].join("-");
};

interface CandidateSource {
  id: string;
  source: string;
  integrationPlan: string[];
  choice?: ConstructionChoice;
}

export function reconstructFunction(options: ReconstructOptions): ResultBundle {
  const startedAt = Date.now();
  const notify = options.notify ?? ((line: string) => console.error(line));
  const functionName = options.functionName;

  const location = requireFunctionLocation(functionName);
  const container = location.container;
  const span = location.span;
  const outputDirectory = options.outputDirectory ?? join(ROOT, "build/matchingReconstruction", functionName);
  mkdirSync(outputDirectory, { recursive: true });
  const artifacts = new ArtifactRecorder(outputDirectory);

  const inputsRead = [
    container.targetPath,
    container.paths.splat,
    container.paths.symbolAddrs,
    container.paths.undefinedSyms,
    container.paths.undefinedFuncs,
  ];

  /* The flag set the production build would use for this translation unit.
   * Recorded whether or not a candidate ever compiles, because "which
   * experiment was this" is a fact about the run, not about its outcome. */
  const overrideFlags = options.ignoreFlagOverrides ? undefined : loadFlagOverrides().get(functionName);
  const build: ResultBundle["build"] = {
    containerKind: container.kind,
    cc1Flags: [...configuredCc1FlagsForContainer(container.kind), ...(overrideFlags ?? [])],
    ...(overrideFlags ? { overrideFlags } : {}),
  };

  const bundle: ResultBundle = {
    schemaVersion: MATCHING_RECONSTRUCTION_SCHEMA_VERSION,
    functionName,
    containerId: container.id,
    vram: span.vram,
    sizeBytes: span.size,
    state: "tool-failure",
    candidates: [],
    build,
    contextMode: contextMode(),
    artifacts: { files: {} },
    inputsRead,
    compiles: 0,
    wallMs: 0,
  };

  const refuse = (
    state: Exclude<ResultBundle["state"], "exact-candidate" | "verified">,
    category: FailureCategory,
    detail: string,
    vram?: number[],
  ): void => {
    bundle.state = state;
    bundle.unresolved = { state, category, detail, ...(vram && vram.length > 0 ? { vram } : {}) };
  };

  const finish = (result: ResultBundle): ResultBundle => {
    result.wallMs = Date.now() - startedAt;
    result.artifacts = artifacts.manifest();
    const provenance = computeProvenance(functionName, {
      files: [container.targetPath, container.paths.splat],
      values: {
        options: {
          maxCandidates: options.maxCandidates,
          exhaustive: options.exhaustive,
          ignoreFlagOverrides: options.ignoreFlagOverrides,
        },
        contextMode: contextMode(),
        cc1Flags: build.cc1Flags,
      },
      implementation: ["tools/agent/matching-reconstruction"],
    });
    writeStableJson(join(outputDirectory, "result.json"), stamped(result, provenance));
    return result;
  };

  /**
   * Compile-and-compare every constructed candidate in order, stopping at the
   * first exact match unless asked to be exhaustive, and settle the terminal
   * state. Shared by every supported class — the oracle is the same oracle.
   */
  const evaluate = (allSources: CandidateSource[]): void => {
    /* Cold mode withholds the project's umbrella header, which is recovered
     * material: it declares the globals and types somebody already recovered.
     * A candidate that compiles only against it is a warm result. */
    const sources = warmContextAllowed()
      ? allSources
      : allSources.filter((candidate) => !candidate.id.endsWith("-umbrella"));
    /* The domain is what this run is *allowed* to compile, not what the
     * constructor produced. Comparing the evaluated count against the
     * unfiltered total reports a cold run that saw its whole domain as stopped
     * by the candidate budget, which turns a real "nothing here matches" into a
     * spurious "try harder". */
    const totalConstructible = sources.length;
    if (sources.length !== allSources.length) {
      bundle.partialFacts = {
        ...(bundle.partialFacts ?? {}),
        notes: [
          ...(bundle.partialFacts?.notes ?? []),
          `${allSources.length - sources.length} umbrella-context candidate(s) were withheld: ${describeContextMode()}`,
        ],
      };
    }
    const maxCandidates = options.maxCandidates ?? sources.length;
    const candidatesDir = join(outputDirectory, "candidates");
    mkdirSync(candidatesDir, { recursive: true });

    let winner: ResultBundle["winner"];
    let undeterminedSeen = 0;
    let bestEffortCandidate: { outcome: CandidateOutcome; source: string; integrationPlan: string[] } | undefined;

    for (const candidate of sources) {
      if (bundle.candidates.length >= maxCandidates) break;
      if (winner && !options.exhaustive) break;

      const sourcePath = artifacts.write(join("candidates", `${candidate.id}.c`), candidate.source);

      const outcome: CandidateOutcome = {
        id: candidate.id,
        choice: candidate.choice ?? ({} as ConstructionChoice),
        sourcePath,
        verdict: "error",
      };
      try {
        const compiled = compileSource(sourcePath, join(candidatesDir, candidate.id), functionName, {
          assemble: true,
          useOverrides: !options.ignoreFlagOverrides,
          containerKind: container.kind,
        });
        bundle.compiles++;

        /* S3 §3: any implicit function declaration in the compiled unit makes
         * the candidate a construction failure — an undeclared callee changes
         * codegen by defining `$v0` even when nothing reads it. */
        const implicit = detectImplicitDeclarations(readFileSync(compiled.preprocessed, "utf-8"), functionName);
        if (implicit.length > 0) {
          outcome.compileError = `implicit declaration(s): ${implicit.join(", ")}`;
          notify(`  ${candidate.id}: implicit declaration — construction failure (${implicit[0]})`);
          bundle.candidates.push(outcome);
          continue;
        }

        /* A zero exit status is not a claim that the source is valid C. A
         * candidate the front end diagnosed as violating a constraint is a
         * construction failure even if it would assemble to the target's exact
         * words — the byte oracle compares machine output and cannot see a
         * source defect, so accepting one here files invalid C as recovered. */
        const rejection = rejectionFromDiagnostics(compiled.diagnostics);
        if (rejection) {
          outcome.compileError = `invalid C accepted by the front end: ${rejection}`;
          notify(`  ${candidate.id}: invalid C — construction failure (${rejection})`);
          bundle.candidates.push(outcome);
          continue;
        }

        const oracle = compareFunction(functionName, { objectPath: compiled.object!, container });
        outcome.verdict = oracle.verdict === "stub" ? "error" : oracle.verdict;
        outcome.matchedWords = oracle.same;
        const totalOracleWords = Math.max(oracle.targetWords.length, oracle.candidateWords.length);
        outcome.totalWords = totalOracleWords;
        /* The complete count is what ranking uses; the list is a sample for a
         * reader. Ranking on the sample's length compares a truncated number
         * with an untruncated one and picks whichever ran first. */
        outcome.differingCount = oracle.differing.length;
        outcome.differingVram = oracle.differing.slice(0, 16);
        if (oracle.verdict === "undetermined") undeterminedSeen++;
        if (oracle.verdict === "match") {
          winner = { ...outcome, source: candidate.source, integrationPlan: candidate.integrationPlan };
          notify(`  ${candidate.id}: MATCH (${oracle.same}/${outcome.totalWords})`);
        } else {
          const diffCount = oracle.differing.length;
          const incumbent = bestEffortCandidate?.outcome.differingCount ?? Number.POSITIVE_INFINITY;
          if (diffCount < incumbent) {
            bestEffortCandidate = { outcome, source: candidate.source, integrationPlan: candidate.integrationPlan };
          }
          notify(`  ${candidate.id}: ${outcome.verdict} (${oracle.same}/${outcome.totalWords})`);
        }
      } catch (error) {
        outcome.compileError = (error instanceof Error ? error.message : String(error)).slice(0, 500);
        notify(`  ${candidate.id}: compile error`);
      }
      bundle.candidates.push(outcome);
    }

    if (winner) {
      bundle.state = "exact-candidate";
      bundle.winner = winner;
      artifacts.write("winner.c", winner.source);
      return;
    }

    if (bundle.candidates.length < totalConstructible) {
      refuse(
        "budget-exhausted",
        "budget-exhausted",
        `${totalConstructible - bundle.candidates.length} of ${totalConstructible} constructible candidates remain unevaluated`,
      );
    } else if (undeterminedSeen > 0 && bundle.candidates.every((candidate) => candidate.verdict !== "mismatch")) {
      refuse(
        "oracle-undetermined",
        "oracle-undetermined",
        `${undeterminedSeen} candidate(s) could not be byte-compared (unresolved relocations); none mismatched, none proven`,
      );
    } else {
      refuse(
        "domain-exhausted",
        "domain-exhausted",
        `all ${bundle.candidates.length} constructible candidates in the bounded domain were evaluated without an exact result`,
      );
    }

    /* The closest draft survives every stop, not only domain exhaustion. A
     * budget stop is in fact the likeliest to hold a useful one. */
    if (bestEffortCandidate) {
      const diffSummary = `${bestEffortCandidate.outcome.matchedWords}/${bestEffortCandidate.outcome.totalWords} words match, ` +
        `${bestEffortCandidate.outcome.differingCount ?? 0} differing word(s)`;
      bundle.bestEffort = {
        ...bestEffortCandidate.outcome,
        source: bestEffortCandidate.source,
        integrationPlan: bestEffortCandidate.integrationPlan,
        diffSummary,
      };
      artifacts.write("best-effort.c", bestEffortCandidate.source);
    }
  };

  try {
    /* 1. Target facts: the original words, decoded and executed. */
    const image = readFileSync(containerTargetPath(container));
    const rom = vramToRom(container, span.vram);
    const insns = decodeBytes(image.subarray(rom, rom + span.size), span.vram);

    /* Population facts are read from the words themselves, so they hold even
     * when execution refuses on the first instruction. A census that buckets
     * on these is describing the target, not the error message. */
    bundle.features = targetFeatures(insns);
    const partialFacts: PartialFacts = { features: bundle.features };
    bundle.partialFacts = partialFacts;

    /**
     * The recovered-context product is written for every outcome, including
     * the ones that produce no C at all. A consumer that needs parameters,
     * call signatures or field offsets should never have to get them by
     * parsing a draft that may not exist.
     */
    const publishContext = (context: RecoveredContext): void => {
      artifacts.write("context.json", stableJson(context));
      artifacts.write("context.txt", `${renderContext(context).join("\n")}\n`);
      partialFacts.notes = [
        ...(partialFacts.notes ?? []),
        `recovered context: ${context.parameters.length} parameter(s), ${context.calls.length} call site(s), ` +
        `${context.globals.length} global cell(s), ${context.objects.length} object base(s)`,
        ...context.operations.map((operation) => `recovered operation: ${operation.summary}`),
      ];
      /* A recognised compiler operation changes what the refusal *means*: a
       * region of unaligned accesses that is a block move is ordinary
       * compiler output, and filing it as handwritten code would send the
       * wrong capability after it. */
      if (context.operations.length > 0) bundle.recognizedOperations = context.operations.map((operation) => operation.summary);
    };

    let executed;
    try {
      /* S1: resolve every call target to a symbol through the container's
       * symbol index (requires a container-scoped resolver; the executor
       * stays container-agnostic). */
      const symbolIndex = loadSymbolIndex(container);
      executed = executeFunction(insns, {
        gpValue: container.gpValue || undefined,
        readWord: (vram) => {
          /* Jump tables live in the container image; relocate through the
           * same load-address mapping as the code itself. */
          const rom = vramToRom(container, vram);
          if (rom < 0 || rom + 4 > image.length) return undefined;
          return image.readUInt32LE(rom);
        },
        resolveCallTarget: (address) => {
          const resolved = resolveAddress(symbolIndex, address >>> 0);
          return resolved ? resolved.symbol : null;
        },
      });
    } catch (error) {
      if (error instanceof UnsupportedTarget) {
        /* Even a refused function yields call-site facts: `jal` targets are
         * absolute and resolve without any execution at all. */
        partialFacts.calls = callFacts(insns, container);
        publishContext(recoverContextFrom({
          functionName, container, vram: span.vram, sizeBytes: span.size, insns,
          notes: [`symbolic execution refused (${error.category}): ${error.reason}`],
        }));
        refuse("unsupported-target", error.category, error.reason, error.vram);
        return finish(bundle);
      }
      throw error;
    }
    notify(`  relation recovery: ${executed.states} states, ${executed.steps} steps, ${executed.loads.length} load atoms`);
    publishContext(recoverContextFrom({
      functionName, container, vram: span.vram, sizeBytes: span.size, insns, executed,
    }));

    const rootNode = executed.arena.node(executed.root);

    /* 2a. A single leaf: the straight-line effect class. */
    if (rootNode.kind === "leaf") {
      const relation = fitStraightLineEffects(rootNode.value, rootNode.effects);
      if ("unfit" in relation) {
        refuse("unsupported-target", "relation-unfit", relation.unfit);
        return finish(bundle);
      }
      bundle.effectRelation = relation;
      notify(`  ${relation.evidence[0]}`);

      const constructed = constructEffectCandidates(functionName, relation, executed.loads, container);
      if ("unresolved" in constructed) {
        refuse("context-unresolved", contextCategory(constructed.unresolved), constructed.unresolved);
        return finish(bundle);
      }
      if ("invalid" in constructed) {
        refuse("unsupported-target", "structure-unsupported", constructed.invalid);
        return finish(bundle);
      }
      evaluate(
        constructed.map((candidate, index) => ({
          id: `${String(index).padStart(3, "0")}-${candidate.label}`,
          source: candidate.source,
          integrationPlan: candidate.integrationPlan,
        })),
      );
      return finish(bundle);
    }

    /* 2b. A decision DAG with pure leaves: the fixed-bound record scan. */
    const fit = fitScanRelation(executed.arena, executed.root);
    if (!fit.fitted) {
      /* 2c. Not a scan — try the bounded guarded-effects class. */
      const guarded = constructGuardedCandidates(functionName, executed.arena, executed.root, executed.loads, container, executed.maskWitnesses);
      if ("unresolved" in guarded) {
        refuse("context-unresolved", contextCategory(guarded.unresolved), guarded.unresolved);
        return finish(bundle);
      }
      if ("invalid" in guarded) {
        /* 2d. Not a guarded structure — try the general control-flow constructor
         * for read-only, call-free decision trees with joins, mixed return/void,
         * or structures larger than the guarded bounds. */
        const controlFlow = constructControlFlowCandidates(functionName, executed.arena, executed.root, executed.loads, container);
        if ("unresolved" in controlFlow) {
          refuse("context-unresolved", contextCategory(controlFlow.unresolved), controlFlow.unresolved);
          return finish(bundle);
        }
        if (!("invalid" in controlFlow)) {
          notify(`  general control-flow structure; ${controlFlow.length} candidate(s)`);
          evaluate(
            controlFlow.map((candidate, index) => ({
              id: `ctrl-${String(index).padStart(3, "0")}-${candidate.label}`,
              source: candidate.source,
              integrationPlan: candidate.integrationPlan,
            })),
          );
          return finish(bundle);
        }
        /* Both constructors failed — report the best detail. */
        refuse(
          "unsupported-target",
          "structure-unsupported",
          `not a fixed-stride scan (${fit.reason}); guarded construction: ${guarded.invalid}; general control flow: ${controlFlow.invalid}`,
        );
        return finish(bundle);
      }
      notify(`  guarded decision structure; ${guarded.length} candidate(s)`);
      evaluate(
        guarded.map((candidate, index) => ({
          id: `${String(index).padStart(3, "0")}-${candidate.label}`,
          source: candidate.source,
          integrationPlan: candidate.integrationPlan,
        })),
      );
      return finish(bundle);
    }
    bundle.relation = fit.relation;
    notify(`  ${describeRelation(fit.relation)}`);

    /* 3. Origin alternatives from independently witnessed accesses. */
    const indexes = [ensureAccessIndex(container)];
    const exe = loadContainer("exe");
    if (exe && exe.id !== container.id) indexes.push(ensureAccessIndex(exe));
    for (const index of indexes) {
      inputsRead.push(join("build/matchingReconstruction/access-index", `${index.value.containerId}.json`));
    }
    const derived = deriveOrigins(
      container,
      functionName,
      fit.relation.base,
      fit.relation.stride,
      fit.relation.count,
      fit.relation.witnessedExtent,
      indexes.map((index) => index.value),
    );
    bundle.origins = derived.origins;
    for (const origin of derived.origins) {
      notify(`  origin: ${origin.kind === "standalone" ? origin.symbol : `${origin.parentSymbol} + 0x${origin.offset.toString(16)}`} — ${origin.evidence[0]}`);
    }
    if (derived.origins.length === 0) {
      refuse(
        "context-unresolved",
        "no-origin-evidence",
        `no labeled origin for the scanned storage at 0x${fit.relation.base.toString(16)}: ${derived.notes.join("; ") || "no witnesses"}`,
      );
      return finish(bundle);
    }

    /* 4. Deterministic bounded enumeration through the byte oracle. */
    const choices = enumerateChoices(fit.relation, derived.origins);
    const sources: CandidateSource[] = [];
    for (let index = 0; index < choices.length; index++) {
      const choice = choices[index]!;
      const constructed = constructCandidate(functionName, fit.relation, choice);
      if ("invalid" in constructed) continue;
      sources.push({
        id: choiceId(index, choice),
        source: constructed.source,
        integrationPlan: constructed.integrationPlan,
        choice,
      });
    }
    evaluate(sources);
    return finish(bundle);
  } catch (error) {
    refuse("tool-failure", "tool-failure", error instanceof Error ? `${error.message}` : String(error));
    return finish(bundle);
  }
}

/**
 * Which context capability a `context-unresolved` refusal is asking for.
 *
 * The constructors return prose because the prose is what a reader needs; the
 * category is what a capability plan needs. Only three shapes exist at this
 * boundary and each has a distinct producer, so the mapping is a small closed
 * decision rather than open-ended text mining.
 */
function contextCategory(detail: string): FailureCategory {
  if (detail.includes("signature") || detail.includes("callee")) return "callee-signature-unknown";
  if (detail.includes("call-result") || detail.includes("CR(")) return "call-result-unbound";
  if (detail.includes("parameter plan")) return "parameter-plan-unavailable";
  return "no-origin-evidence";
}

/**
 * Call sites read straight from the words: a `jal` target is absolute, so this
 * holds even for a function the executor refused on its first instruction.
 */
function callFacts(
  insns: ReturnType<typeof decodeBytes>,
  container: Parameters<typeof loadSymbolIndex>[0],
): NonNullable<PartialFacts["calls"]> {
  let index: ReturnType<typeof loadSymbolIndex> | undefined;
  try {
    index = loadSymbolIndex(container);
  } catch {
    index = undefined;
  }
  const calls: NonNullable<PartialFacts["calls"]> = [];
  for (const insn of insns) {
    if (insn.op === "jalr") {
      calls.push({ vram: insn.vram, callee: `indirect@0x${insn.vram.toString(16)}`, indirect: true, resolved: false });
      continue;
    }
    if (insn.op !== "jal" || insn.target === undefined) continue;
    const address = insn.target >>> 0;
    const resolved = index ? resolveAddress(index, address) : null;
    calls.push({
      vram: insn.vram,
      callee: resolved ? resolved.symbol : `0x${address.toString(16)}`,
      indirect: false,
      resolved: resolved !== null,
    });
  }
  return calls;
}
