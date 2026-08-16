#!/usr/bin/env npx tsx
/**
 * Solve for the local-alloc state that reproduces the target's assignment.
 *
 * The replay and the allocator counterfactual this reads are produced here when
 * they are not current for the source on disk. Nothing has to be run first.
 *
 *   npx tsx tools/agent/solveLocalAllocationState.ts <function> [--max-phantoms 3] [--max-solutions 16]
 */

import { join } from "node:path";
import { ROOT, normalizeFunctionName } from "./decompToolchain.js";
import {
  ensureAllocatorCounterfactual,
  ensureLocalAllocationAnalysis,
} from "./compiler-oracle/ensure.js";
import { solveLocalAllocationState } from "./compiler-oracle/local-allocation-solver.js";
import { deriveOracleInterventions } from "./compiler-oracle/run.js";
import { renderProvenance, writeStableJson } from "./provenance.js";

const args = process.argv.slice(2);
const name = args.find((argument) => !argument.startsWith("--"));
if (!name) {
  console.error("Usage: npx tsx tools/agent/solveLocalAllocationState.ts <function> [--max-phantoms 3] [--max-solutions 16] [--force-build]");
  process.exit(1);
}

const valueAfter = (flag: string, fallback: number) => {
  const index = args.indexOf(flag);
  return index >= 0 ? Number(args[index + 1]) : fallback;
};

try {
  const functionName = normalizeFunctionName(name);
  const forceBuild = args.includes("--force-build");
  const replay = ensureLocalAllocationAnalysis(functionName, { forceBuild });
  const allocator = ensureAllocatorCounterfactual(functionName);

  const requests = deriveOracleInterventions(allocator.value).forcedLocalAssignments.filter((request) =>
    replay.value.requests.some((assessment) => assessment.pseudo === request.pseudo && assessment.baselineAvailable),
  );
  const solutions = solveLocalAllocationState(replay.value, requests, {
    maxPhantoms: valueAfter("--max-phantoms", 3),
    maxSolutions: valueAfter("--max-solutions", 16),
  });

  const analysis = {
    schemaVersion: 1,
    function: functionName,
    requests,
    status: solutions.length > 0 ? "SAT" : "UNSAT_WITHIN_BOUNDS",
    solutions,
    caveats: [
      "Phantoms are abstract local quantities, not instructions and not source edits.",
      "Static candidate sets are recovered by adding back earlier overlapping stock allocations to each exact find_free_reg candidate list.",
      "Priority bands use GCC 2.95.2 local-alloc's exact floor(log2(refs))*refs*size/lifetime formula.",
      "A solution says which additional clean-C webs/lifetimes could create the target allocation without changing other observed local assignments.",
    ],
  };

  const text = [
    `Local-allocation state solver: ${functionName}`,
    `status: ${analysis.status}`,
    `requests: ${requests.map((request) => `${request.pseudo}:$${request.registerName}`).join(", ") || "none"}`,
    `solutions: ${solutions.length}`,
    "",
    ...solutions.slice(0, 8).flatMap((solution, index) => [
      `solution ${index + 1}: block ${solution.block}, ${solution.phantoms.length} phantom quantities`,
      ...solution.evidence.map((item) => `  - ${item}`),
    ]),
    "",
    renderProvenance([
      { label: "local-allocation replay", ensured: replay },
      { label: "allocator counterfactual", ensured: allocator },
    ]),
  ].join("\n");

  const output = join(ROOT, "build/localAllocationOracle", functionName, "state-solver");
  writeStableJson(join(output, "analysis.json"), analysis);
  writeStableJson(join(output, "summary.json"), { function: functionName, text });
  process.stdout.write(`${text}\n`);
} catch (error) {
  console.error(`solveLocalAllocationState: ${error instanceof Error ? error.message : error}`);
  process.exitCode = 1;
}
