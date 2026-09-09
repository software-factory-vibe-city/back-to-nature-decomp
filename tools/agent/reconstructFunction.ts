/**
 * reconstructFunction.ts — standalone entry point for automatic matching
 * reconstruction (plans/automatic-matching-reconstruction.md, Phase C/F).
 *
 * Takes a function name, reads only target-side artifacts (original bytes,
 * splat configs, symbol tables), and either produces a verified exact clean-C
 * candidate bundle or an explicit unresolved result. Never touches live
 * sources, never commits, never requires Pi, network, or model credentials.
 *
 *   npx tsx tools/agent/reconstructFunction.ts <function> [--json]
 *       [--exhaustive] [--max-candidates N] [--out DIR]
 *
 * Terminal states: exact-candidate, unsupported-target, context-unresolved,
 * oracle-undetermined, domain-exhausted, budget-exhausted, tool-failure.
 * `exact-candidate` means the bundle passed the relocated-byte oracle; it is
 * NOT integrated — integration stays a separately authorized step.
 */

import { normalizeFunctionName } from "./decompToolchain.js";
import { reconstructFunction } from "./matching-reconstruction/engine.js";
import { describeRelation } from "./matching-reconstruction/scan-relation.js";

function usage(): never {
  console.error("usage: npx tsx tools/agent/reconstructFunction.ts <function> [--json] [--exhaustive] [--max-candidates N] [--out DIR]");
  process.exit(2);
}

const args = process.argv.slice(2);
let functionName: string | undefined;
let json = false;
let exhaustive = false;
let maxCandidates: number | undefined;
let outputDirectory: string | undefined;

for (let index = 0; index < args.length; index++) {
  const arg = args[index]!;
  if (arg === "--json") json = true;
  else if (arg === "--exhaustive") exhaustive = true;
  else if (arg === "--max-candidates") maxCandidates = Number(args[++index]);
  else if (arg === "--out") outputDirectory = args[++index];
  else if (arg.startsWith("--")) usage();
  else if (functionName) usage();
  else functionName = normalizeFunctionName(arg);
}
if (!functionName) usage();
if (maxCandidates !== undefined && (!Number.isInteger(maxCandidates) || maxCandidates < 1)) usage();

const result = reconstructFunction({
  functionName,
  exhaustive,
  maxCandidates,
  outputDirectory,
  notify: json ? () => {} : (line) => console.error(line),
});

if (json) {
  console.log(JSON.stringify(result, null, 2));
} else {
  console.log(`${result.functionName} (${result.containerId}, 0x${result.vram.toString(16)}, ${result.sizeBytes} bytes)`);
  console.log(`STATE: ${result.state}`);
  if (result.relation) console.log(`relation: ${describeRelation(result.relation)}`);
  if (result.unresolved) console.log(`reason: ${result.unresolved.detail}`);
  console.log(`candidates evaluated: ${result.candidates.length}, compiles: ${result.compiles}, wall: ${result.wallMs}ms`);
  if (result.winner) {
    console.log(`winner: ${result.winner.id} (${result.winner.matchedWords}/${result.winner.totalWords} words byte-identical)`);
    console.log("--- winner.c ---");
    console.log(result.winner.source);
    console.log("integration plan (requires explicit authorization):");
    for (const step of result.winner.integrationPlan) console.log(`  - ${step}`);
  }
}
