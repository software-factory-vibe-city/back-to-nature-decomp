#!/usr/bin/env npx tsx
import { createHash } from "crypto";
import { mkdirSync, readFileSync, writeFileSync } from "fs";
import { basename, join, relative, resolve } from "path";
import { assembleTarget, normalizeFunctionName, ROOT } from "./decompToolchain.js";
import { buildDiagnosticCompiler } from "./compiler-oracle/build.js";
import { replayLocalAllocation } from "./compiler-oracle/local-allocation.js";
import { compileOracleVariant, instructionComparison } from "./compiler-oracle/run.js";

const args = process.argv.slice(2);
const functionArg = args[0];
const sourceArg = args[1];
if (!functionArg || !sourceArg) {
  console.error("Usage: npx tsx tools/agent/inspectLocalAllocationVariant.ts <function> <source.c> [--block N]");
  process.exit(1);
}
const functionName = normalizeFunctionName(functionArg);
const source = resolve(ROOT, sourceArg);
const blockIndex = args.indexOf("--block");
const focusBlock = blockIndex >= 0 ? Number(args[blockIndex + 1]) : undefined;
const compiler = buildDiagnosticCompiler();
const id = createHash("sha256").update(readFileSync(source)).update(compiler.buildId).digest("hex").slice(0, 16);
const output = join(ROOT, "build/localAllocationOracle", functionName, "variants", `${basename(source, ".c")}-${id}`);
mkdirSync(output, { recursive: true });
const compiled = compileOracleVariant(functionName, source, compiler.compiler, output, {
  scheduleEdges: [], forcedLocalAssignments: [], forbiddenLocalCandidates: [],
});
const replay = replayLocalAllocation(compiled.events, []);
const target = assembleTarget(functionName, join(output, "target"));
const comparison = instructionComparison(compiled.object, target);
const quantities = focusBlock === undefined ? replay.quantities : replay.quantities.filter((quantity) => quantity.block === focusBlock);
const decisions = focusBlock === undefined ? replay.decisions : replay.decisions.filter((decision) => decision.block === focusBlock);
writeFileSync(join(output, "analysis.json"), JSON.stringify({
  schemaVersion: 1, function: functionName, source: relative(ROOT, source).replaceAll("\\", "/"),
  comparison, replayVerified: replay.replayVerified, quantities, decisions,
}, null, 2) + "\n");
const lines = [
  `Local-allocation variant: ${functionName}`,
  `source: ${relative(ROOT, source)}`,
  `target indexed: ${comparison.exact}/${comparison.total}`,
  `stock replay: ${replay.replayedChoices}/${replay.ordinaryChoices}`,
  "",
  ...decisions.filter((decision) => decision.chosen !== undefined).map((decision) =>
    `b${decision.block} q${decision.qty} [${decision.members.join(",")}] life=${decision.born}..${decision.dead} refs=${decision.references} -> $${decision.chosen} candidates=${decision.available.slice(0, 8).join(",")}`
  ),
  "",
];
writeFileSync(join(output, "summary.txt"), lines.join("\n"));
process.stdout.write(lines.join("\n"));
