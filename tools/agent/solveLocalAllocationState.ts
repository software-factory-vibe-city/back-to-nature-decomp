#!/usr/bin/env npx tsx
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { ROOT, normalizeFunctionName } from "./decompToolchain.js";
import type { AllocatorCounterfactualAnalysis } from "./allocator-counterfactual/types.js";
import type { LocalAllocationReplay } from "./compiler-oracle/local-allocation.js";
import { solveLocalAllocationState } from "./compiler-oracle/local-allocation-solver.js";
import { deriveOracleInterventions } from "./compiler-oracle/run.js";

const args = process.argv.slice(2);
const name = args.find((arg) => !arg.startsWith("--"));
if (!name) {
  console.error("Usage: npx tsx tools/agent/solveLocalAllocationState.ts <function> [--max-phantoms 3] [--max-solutions 16]");
  process.exit(1);
}
const valueAfter = (flag: string, fallback: number) => {
  const index = args.indexOf(flag);
  return index >= 0 ? Number(args[index + 1]) : fallback;
};
const functionName = normalizeFunctionName(name);
const localPath = join(ROOT, "build/localAllocationOracle", functionName, "analysis.json");
const allocatorPath = join(ROOT, "build/allocatorCounterfactual", functionName, "analysis.json");
if (!existsSync(localPath)) throw new Error(`Missing build/localAllocationOracle/${functionName}/analysis.json`);
if (!existsSync(allocatorPath)) throw new Error(`Missing build/allocatorCounterfactual/${functionName}/analysis.json`);
const replay = JSON.parse(readFileSync(localPath, "utf8")) as LocalAllocationReplay;
const allocator = JSON.parse(readFileSync(allocatorPath, "utf8")) as AllocatorCounterfactualAnalysis;
const requests = deriveOracleInterventions(allocator).forcedLocalAssignments.filter((request) =>
  replay.requests.some((assessment) => assessment.pseudo === request.pseudo && assessment.baselineAvailable)
);
const solutions = solveLocalAllocationState(replay, requests, {
  maxPhantoms: valueAfter("--max-phantoms", 3),
  maxSolutions: valueAfter("--max-solutions", 16),
});
const output = join(ROOT, "build/localAllocationOracle", functionName, "state-solver");
mkdirSync(output, { recursive: true });
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
writeFileSync(join(output, "analysis.json"), JSON.stringify(analysis, null, 2) + "\n");
const lines = [
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
];
writeFileSync(join(output, "summary.txt"), lines.join("\n"));
process.stdout.write(lines.join("\n"));
