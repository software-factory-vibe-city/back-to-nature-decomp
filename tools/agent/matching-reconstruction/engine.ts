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
 *   - a test DAG with pure leaves: the fixed-bound read-only record scan.
 * Anything else reports the blocking evidence, never a guess.
 */

import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT, compileSource } from "../decompToolchain.js";
import { containerTargetPath, loadContainer, vramToRom } from "../../lib/container.js";
import { requireFunctionLocation } from "../../lib/symbolIndex.js";
import { compareFunction } from "../../lib/functionOracle.js";
import { computeProvenance, stamped, writeStableJson } from "../provenance.js";
import { decodeBytes, executeFunction, UnsupportedTarget } from "./exec.js";
import { fitScanRelation, describeRelation } from "./scan-relation.js";
import { ensureAccessIndex, deriveOrigins } from "./access-index.js";
import { constructCandidate, enumerateChoices } from "./construct.js";
import { constructEffectCandidates, constructGuardedCandidates, fitStraightLineEffects } from "./effect-construct.js";
import {
  MATCHING_RECONSTRUCTION_SCHEMA_VERSION,
  type CandidateOutcome,
  type ConstructionChoice,
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

  const inputsRead = [
    container.targetPath,
    container.paths.splat,
    container.paths.symbolAddrs,
    container.paths.undefinedSyms,
    container.paths.undefinedFuncs,
  ];

  const bundle: ResultBundle = {
    schemaVersion: MATCHING_RECONSTRUCTION_SCHEMA_VERSION,
    functionName,
    containerId: container.id,
    vram: span.vram,
    sizeBytes: span.size,
    state: "tool-failure",
    candidates: [],
    inputsRead,
    compiles: 0,
    wallMs: 0,
  };

  const finish = (result: ResultBundle): ResultBundle => {
    result.wallMs = Date.now() - startedAt;
    const provenance = computeProvenance(functionName, {
      files: [container.targetPath, container.paths.splat],
      values: { options: { maxCandidates: options.maxCandidates, exhaustive: options.exhaustive } },
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
  const evaluate = (sources: CandidateSource[], totalConstructible: number): void => {
    const maxCandidates = options.maxCandidates ?? sources.length;
    const candidatesDir = join(outputDirectory, "candidates");
    mkdirSync(candidatesDir, { recursive: true });

    let winner: ResultBundle["winner"];
    let undeterminedSeen = 0;

    for (const candidate of sources) {
      if (bundle.candidates.length >= maxCandidates) break;
      if (winner && !options.exhaustive) break;

      const sourcePath = join(candidatesDir, `${candidate.id}.c`);
      writeFileSync(sourcePath, candidate.source);

      const outcome: CandidateOutcome = {
        id: candidate.id,
        choice: candidate.choice ?? ({} as ConstructionChoice),
        sourcePath,
        verdict: "error",
      };
      try {
        const artifacts = compileSource(sourcePath, join(candidatesDir, candidate.id), functionName, {
          assemble: true,
          useOverrides: false,
          containerKind: container.kind,
        });
        bundle.compiles++;
        const oracle = compareFunction(functionName, { objectPath: artifacts.object!, container });
        outcome.verdict = oracle.verdict === "stub" ? "error" : oracle.verdict;
        outcome.matchedWords = oracle.same;
        outcome.totalWords = Math.max(oracle.targetWords.length, oracle.candidateWords.length);
        outcome.differingVram = oracle.differing.slice(0, 16);
        if (oracle.verdict === "undetermined") undeterminedSeen++;
        if (oracle.verdict === "match") {
          winner = { ...outcome, source: candidate.source, integrationPlan: candidate.integrationPlan };
          notify(`  ${candidate.id}: MATCH (${oracle.same}/${outcome.totalWords})`);
        } else {
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
      writeFileSync(join(outputDirectory, "winner.c"), winner.source);
    } else if (bundle.candidates.length < totalConstructible) {
      bundle.state = "budget-exhausted";
      bundle.unresolved = {
        state: "budget-exhausted",
        detail: `${totalConstructible - bundle.candidates.length} of ${totalConstructible} constructible candidates remain unevaluated`,
      };
    } else if (undeterminedSeen > 0 && bundle.candidates.every((candidate) => candidate.verdict !== "mismatch")) {
      bundle.state = "oracle-undetermined";
      bundle.unresolved = {
        state: "oracle-undetermined",
        detail: `${undeterminedSeen} candidate(s) could not be byte-compared (unresolved relocations); none mismatched, none proven`,
      };
    } else {
      bundle.state = "domain-exhausted";
      bundle.unresolved = {
        state: "domain-exhausted",
        detail: `all ${bundle.candidates.length} constructible candidates in the bounded domain were evaluated without an exact result`,
      };
    }
  };

  try {
    /* 1. Target facts: the original words, decoded and executed. */
    const image = readFileSync(containerTargetPath(container));
    const rom = vramToRom(container, span.vram);
    const insns = decodeBytes(image.subarray(rom, rom + span.size), span.vram);

    let executed;
    try {
      executed = executeFunction(insns, {
        gpValue: container.gpValue || undefined,
        readWord: (vram) => {
          /* Jump tables live in the container image; relocate through the
           * same load-address mapping as the code itself. */
          const rom = vramToRom(container, vram);
          if (rom < 0 || rom + 4 > image.length) return undefined;
          return image.readUInt32LE(rom);
        },
      });
    } catch (error) {
      if (error instanceof UnsupportedTarget) {
        bundle.state = "unsupported-target";
        bundle.unresolved = { state: "unsupported-target", detail: error.reason, vram: error.vram };
        return finish(bundle);
      }
      throw error;
    }
    notify(`  relation recovery: ${executed.states} states, ${executed.steps} steps, ${executed.loads.length} load atoms`);

    const rootNode = executed.arena.node(executed.root);

    /* 2a. A single leaf: the straight-line effect class. */
    if (rootNode.kind === "leaf") {
      const relation = fitStraightLineEffects(rootNode.value, rootNode.effects);
      if ("unfit" in relation) {
        bundle.state = "unsupported-target";
        bundle.unresolved = { state: "unsupported-target", detail: relation.unfit };
        return finish(bundle);
      }
      bundle.effectRelation = relation;
      notify(`  ${relation.evidence[0]}`);

      const constructed = constructEffectCandidates(functionName, relation, executed.loads, container);
      if ("unresolved" in constructed) {
        bundle.state = "context-unresolved";
        bundle.unresolved = { state: "context-unresolved", detail: constructed.unresolved };
        return finish(bundle);
      }
      if ("invalid" in constructed) {
        bundle.state = "unsupported-target";
        bundle.unresolved = { state: "unsupported-target", detail: constructed.invalid };
        return finish(bundle);
      }
      evaluate(
        constructed.map((candidate, index) => ({
          id: `${String(index).padStart(3, "0")}-${candidate.label}`,
          source: candidate.source,
          integrationPlan: candidate.integrationPlan,
        })),
        constructed.length,
      );
      return finish(bundle);
    }

    /* 2b. A decision DAG with pure leaves: the fixed-bound record scan. */
    const fit = fitScanRelation(executed.arena, executed.root);
    if (!fit.fitted) {
      /* 2c. Not a scan — try the bounded guarded-effects class. */
      const guarded = constructGuardedCandidates(functionName, executed.arena, executed.root, executed.loads, container, executed.maskWitnesses);
      if ("unresolved" in guarded) {
        bundle.state = "context-unresolved";
        bundle.unresolved = { state: "context-unresolved", detail: guarded.unresolved };
        return finish(bundle);
      }
      if ("invalid" in guarded) {
        bundle.state = "unsupported-target";
        bundle.unresolved = {
          state: "unsupported-target",
          detail: `not a fixed-stride scan (${fit.reason}); guarded construction: ${guarded.invalid}`,
        };
        return finish(bundle);
      }
      notify(`  guarded decision structure; ${guarded.length} candidate(s)`);
      evaluate(
        guarded.map((candidate, index) => ({
          id: `${String(index).padStart(3, "0")}-${candidate.label}`,
          source: candidate.source,
          integrationPlan: candidate.integrationPlan,
        })),
        guarded.length,
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
      bundle.state = "context-unresolved";
      bundle.unresolved = {
        state: "context-unresolved",
        detail: `no labeled origin for the scanned storage at 0x${fit.relation.base.toString(16)}: ${derived.notes.join("; ") || "no witnesses"}`,
      };
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
    evaluate(sources, sources.length);
    return finish(bundle);
  } catch (error) {
    bundle.state = "tool-failure";
    bundle.unresolved = {
      state: "tool-failure",
      detail: error instanceof Error ? `${error.message}` : String(error),
    };
    return finish(bundle);
  }
}
