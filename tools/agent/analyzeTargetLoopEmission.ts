#!/usr/bin/env npx tsx
/**
 * analyzeTargetLoopEmission.ts — what the ORIGINAL's loop pass must have done.
 *
 * Every pass in this pipeline has two instruments: one that observes the
 * candidate, and one that derives the requirement from the target.
 * `psx_analyze_target_schedule` states the scheduler's requirement,
 * `psx_allocator_counterfactual` states the allocator's. `psx_loop_trace`
 * observes `loop.c`. This is the missing half — without it an agent can watch
 * its own loop pass and has nothing to compare it against, so it falls back on
 * the byte residual, which for a preheader-order residual is flat across every
 * source spelling and ranks the mechanism-correct variant worst.
 *
 * Derived from the target's bytes alone, so it works on a bare INCLUDE_ASM
 * stub and is available before the first line of source is written.
 *
 * Usage:
 *   npx tsx tools/agent/analyzeTargetLoopEmission.ts <function>
 *   npx tsx tools/agent/analyzeTargetLoopEmission.ts <function> --source <candidate.c>
 *   npx tsx tools/agent/analyzeTargetLoopEmission.ts <function> --json
 */

import { normalizeFunctionName } from "./decompToolchain.js";
import { loadSymbolAddresses, requireFunctionLocation } from "../lib/symbolIndex.js";
import { addressEncodedInName } from "../lib/symbolIndex.js";
import { targetProgram } from "./idiomSearch.js";
import { deriveRequirement } from "./loop-emission/derive.js";
import { checkRequirement, classifyCandidate, emissionDistance, goalsFor, type PreheaderVerdict } from "./loop-emission/compare.js";
import { renderGoals, renderPrecedents, renderRequirement, renderVerdicts } from "./loop-emission/render.js";
import { precedentIndex, precedentsFor, type PrecedentHit } from "./loop-emission/precedents.js";
import { loopTrace } from "./loopTrace.js";
import type { LoopEmissionRequirement } from "./loop-emission/types.js";

/**
 * Name <-> address for this function's container.
 *
 * Both directions are needed and for different reasons: the target lift renders
 * an unnamed datum as an offset from the nearest known symbol, so the report
 * wants a real name; and the compiler's RTL names symbols outright, so the
 * comparison wants their addresses.
 */
function symbolMaps(functionName: string): {
  addressOf: (name: string) => number | undefined;
  nameOfAddress: (address: number) => string | undefined;
} {
  let byName = new Map<string, number>();
  try {
    byName = loadSymbolAddresses(requireFunctionLocation(functionName).container);
  } catch {
    /* No container index available; fall back to names that encode their own
       address, which is this project's dominant convention for data symbols. */
  }
  const byAddress = new Map<number, string>();
  for (const [name, address] of byName) if (!byAddress.has(address)) byAddress.set(address, name);
  return {
    addressOf: (name) => byName.get(name) ?? addressEncodedInName(name) ?? undefined,
    nameOfAddress: (address) => byAddress.get(address),
  };
}

export function targetLoopEmission(functionName: string): LoopEmissionRequirement {
  const program = targetProgram(functionName);
  if (!program) {
    throw new Error(
      `no target program for ${functionName} — the original assembly could not be lifted. ` +
      "Run `make disassemble` if the archive is missing.",
    );
  }
  return deriveRequirement(program, functionName, { nameOfAddress: symbolMaps(functionName).nameOfAddress });
}

function main(): void {
  const argv = process.argv.slice(2);
  const json = argv.includes("--json");
  const sourceFlag = argv.indexOf("--source");
  const source = sourceFlag >= 0 ? argv[sourceFlag + 1] : undefined;
  const positional = argv.filter((argument, index) =>
    !argument.startsWith("--") && !(sourceFlag >= 0 && index === sourceFlag + 1));

  if (positional.length !== 1 || (sourceFlag >= 0 && !source)) {
    console.error("Usage: npx tsx tools/agent/analyzeTargetLoopEmission.ts <function> [--source <path.c>] [--json]");
    process.exit(1);
  }

  const functionName = normalizeFunctionName(positional[0]!);
  let requirement: LoopEmissionRequirement;
  try {
    requirement = targetLoopEmission(functionName);
  } catch (error) {
    console.error(`analyzeTargetLoopEmission: ${(error as Error).message}`);
    process.exit(1);
    return;
  }

  const goals = requirement.preheaders.flatMap((preheader) => goalsFor(preheader));

  /* Only when something is actually constrained: the scan is not free, and a
     function whose preheaders pin nothing has nothing to find a precedent for. */
  let precedents: PrecedentHit[] = [];
  let scanned = 0;
  if (goals.length > 0) {
    const index = precedentIndex();
    scanned = index.value.scanned;
    const seen = new Set<string>();
    precedents = requirement.preheaders
      .flatMap((preheader) => precedentsFor(preheader, index.value))
      .filter((hit) => hit.precedent.functionName !== functionName)
      .sort((left, right) => right.score - left.score)
      .filter((hit) => {
        const key = `${hit.precedent.functionName}#${hit.precedent.block}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
  }

  let verdicts: PreheaderVerdict[] = [];
  let candidateError: string | undefined;
  if (source !== undefined || goals.length > 0) {
    try {
      const { addressOf } = symbolMaps(functionName);
      const classing = classifyCandidate(loopTrace(functionName, source).result.trace, addressOf);
      verdicts = checkRequirement(requirement.preheaders, classing);
    } catch (error) {
      /* No candidate to score is normal — the requirement stands on its own,
         and on a parked function the source IS a stub. */
      candidateError = (error as Error).message;
    }
  }

  if (json) {
    console.log(JSON.stringify({
      function: functionName,
      requirement,
      goals,
      precedents,
      verdicts,
      distance: verdicts.length > 0 ? emissionDistance(verdicts) : null,
      ...(candidateError ? { candidateError } : {}),
    }, null, 2));
    return;
  }

  console.log(renderRequirement(requirement));
  console.log(renderGoals(goals).join("\n"));
  if (goals.length > 0) {
    console.log("");
    console.log(renderPrecedents(precedents, scanned).join("\n"));
  }
  if (verdicts.length > 0) {
    console.log("");
    console.log(renderVerdicts(verdicts).join("\n"));
  } else if (candidateError) {
    console.log("");
    console.log(`CANDIDATE\n  not scored — ${candidateError}`);
    console.log("  Pass --source with the C you want measured against these goals.");
  }
  if (requirement.caveats.length > 0) {
    console.log("");
    console.log("CAVEATS");
    for (const caveat of requirement.caveats) console.log(`  - ${caveat}`);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) main();
