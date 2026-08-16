#!/usr/bin/env npx tsx
import { normalizeFunctionName } from "./decompToolchain.js";
import { buildDiagnosticCompiler, prepareDiagnosticCompilerContext } from "./compiler-oracle/build.js";
import { renderCompilerOracleReport } from "./compiler-oracle/run.js";
import { ensureCompilerOracleReport } from "./compiler-oracle/ensure.js";
import { renderProvenance } from "./provenance.js";

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
/* Goes through `ensure` so the allocator counterfactual this run needs is
 * produced when it is not current, rather than reported as a missing path. */
const ensured = ensureCompilerOracleReport(functionName, { forceBuild: args.includes("--force-build") });
process.stdout.write(renderCompilerOracleReport(ensured.value.report));
process.stdout.write(`\n${renderProvenance([{ label: "compiler-oracle run", ensured }])}\n`);
