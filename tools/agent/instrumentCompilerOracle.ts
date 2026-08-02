#!/usr/bin/env npx tsx
import { normalizeFunctionName } from "./decompToolchain.js";
import { buildDiagnosticCompiler, prepareDiagnosticCompilerContext } from "./compiler-oracle/build.js";
import { renderCompilerOracleReport, runCompilerOracle } from "./compiler-oracle/run.js";

function usage(): never {
  console.error("Usage: npx tsx tools/agent/instrumentCompilerOracle.ts <function> [--force-build]\n       npx tsx tools/agent/instrumentCompilerOracle.ts --prepare\n       npx tsx tools/agent/instrumentCompilerOracle.ts --build [--force-build]");
  process.exit(1);
}

const args = process.argv.slice(2);
if (args.includes("--prepare")) {
  const prepared = prepareDiagnosticCompilerContext();
  console.log(`Prepared compiler-oracle context ${prepared.buildId} at ${prepared.contextDirectory}`);
  process.exit(0);
}
if (args.includes("--build")) {
  const built = buildDiagnosticCompiler(args.includes("--force-build"));
  console.log(`${built.rebuilt ? "Built" : "Reused"} diagnostic cc1 ${built.buildId}: ${built.compiler}`);
  process.exit(0);
}
const name = args.find((arg) => !arg.startsWith("--"));
if (!name) usage();
const functionName = normalizeFunctionName(name);
const report = runCompilerOracle(functionName, { forceBuild: args.includes("--force-build") });
process.stdout.write(renderCompilerOracleReport(report));
