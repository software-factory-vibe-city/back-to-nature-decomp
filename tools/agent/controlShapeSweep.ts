#!/usr/bin/env npx tsx
/** Bounded, complete-source control-tail experiments; never edits src/. */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { ROOT, normalizeFunctionName, preprocessOnly, resolveSource, runTool } from "./decompToolchain.js";
import { projectPath, sha256, toolchainHash, writeStableJson } from "./provenance.js";
import { C_FRONTEND_IDENTITY, children, declaratorName, field, namedChildren, parseC, walk, type Node } from "./residual-source-search/tree-sitter-c.js";
import { controlShapes, decisionTailSite } from "./control-shapes.js";
import { jumpTrace, type JumpTraceReport } from "./jumpTrace.js";
import { reversePipeline } from "./pipeline-reversal/reverse.js";
import { compareObjectives, rankBlocks, type ResidualObjective } from "./pipeline-reversal/objective.js";
import { orientationFrom } from "./branch-orientation.js";
import { findGeneratedGlobalDefinitions, validateVariantSource } from "./variant-lab/manifest.js";

function tailTokens(source: string, functionName: string, startOrCount: { start: number } | { count: number }): { tokens: string[]; count: number } {
  const tree = parseC(source);
  try {
    let body: Node | undefined;
    walk(tree.rootNode, node => {
      if (node.type === "function_definition" && declaratorName(field(node, "declarator"))?.text === functionName) body = field(node, "body");
      return node.type !== "function_definition";
    });
    if (!body) throw new Error("preprocessed/raw function body unavailable");
    const tokens: string[] = [];
    function visit(node: Node) { if (node.type === "comment") return; if (!node.childCount) tokens.push(node.text); else for (const c of children(node)) visit(c); }
    const statements = namedChildren(body).filter(n => n.type !== "comment");
    const suffix = "start" in startOrCount ? statements.filter(n => n.startIndex >= startOrCount.start) : statements.slice(-startOrCount.count);
    for (const statement of suffix) visit(statement);
    return { tokens, count: suffix.length };
  } finally { tree.delete(); }
}
function validateResultType(cpp: string, functionName: string, variable: string): void {
  const tree = parseC(cpp), aliases = new Map<string, string>();
  let resultType: string | undefined;
  try {
    const addAlias = (node: Node) => {
      const name = declaratorName(field(node, "declarator"))?.text;
      if (name) aliases.set(name, namedChildren(node).some(n => ["pointer_declarator", "array_declarator", "type_qualifier"].includes(n.type)) ? "" : field(node, "type")?.text ?? "");
    };
    walk(tree.rootNode, node => {
      if (node.type === "type_definition") addAlias(node);
      /* A typedef in an unrelated or nested function scope is not evidence
         about this block-top result local. */
      return node.type !== "function_definition";
    });
    walk(tree.rootNode, node => {
      if (node.type !== "function_definition") return true;
      if (declaratorName(field(node, "declarator"))?.text === functionName) {
        for (const declaration of namedChildren(field(node, "body")!)) {
          if (declaration.type === "type_definition") addAlias(declaration);
          if (declaration.type === "declaration" && namedChildren(declaration).some(n => declaratorName(n)?.text === variable)) resultType = field(declaration, "type")?.text;
        }
      }
      return false;
    });
    const seen = new Set<string>();
    while (resultType && aliases.has(resultType) && !seen.has(resultType)) { seen.add(resultType); resultType = aliases.get(resultType); }
    if (!resultType || !["int", "signed", "unsigned", "signed int", "unsigned int"].includes(resultType.replace(/\s+/g, " ").trim())) throw new Error("expanded result-local type is not a verified 32-bit int scalar; narrowing/qualified typedefs are unsupported");
  } finally { tree.delete(); }
}
export interface ControlSweepRow { id: string; form: string; source: string; trace?: JumpTraceReport; objective?: ResidualObjective; error?: string; }
export function controlShapeSweep(functionName: string, sourceOverride: string, max = 64) {
  const sourcePath = resolveSource(functionName, sourceOverride), source = readFileSync(sourcePath, "utf8"), sourceHash = sha256(source);
  const shapes = controlShapes(source, functionName, max);
  const contextDirectory = join(ROOT, "build/controlShapeSweep", functionName, "context", sourceHash.slice(0, 24));
  const cpp = readFileSync(preprocessOnly(sourcePath, contextDirectory, "context"), "utf8"), contextHash = sha256(cpp);
  const rawTail = tailTokens(source, functionName, { start: shapes.site.start });
  const expandedTail = tailTokens(cpp, functionName, { count: rawTail.count });
  if (JSON.stringify(rawTail.tokens) !== JSON.stringify(expandedTail.tokens)) throw new Error("raw/preprocessed tail tokens differ; a macro may hide effects or control flow, so this grammar cannot prove equivalence");
  /* A declaration macro could hide volatile/static/narrowing even when the
     tail tokens agree. Validate the expanded result-local declaration too. */
  if (shapes.site.resultVariable) {
    decisionTailSite(cpp, functionName);
    validateResultType(cpp, functionName, shapes.site.resultVariable);
  }
  const baseline = reversePipeline({ functionName, source: sourcePath, replay: false, outputDirectory: join(contextDirectory, "baseline") });
  const targetHash = sha256(JSON.stringify(baseline.target.machine.insns.map(i => i.word)));
  const implementation = sha256(["controlShapeSweep.ts", "control-shapes.ts", "jumpTrace.ts", "branch-orientation.ts"].map(f => readFileSync(join(ROOT, "tools/agent", f), "utf8")).join("\n"));
  const identity = sha256(JSON.stringify({ sourceHash, contextHash, targetHash, implementation, frontend: C_FRONTEND_IDENTITY, toolchain: toolchainHash(), max })).slice(0, 24);
  const directory = join(ROOT, "build/controlShapeSweep", functionName, identity), candidates = join(directory, "candidates");
  mkdirSync(candidates, { recursive: true });
  const block = orientationFrom(baseline)[0]?.block ?? rankBlocks(baseline.report.objective)[0]?.block.block;
  const inheritedGeneratedGlobals = findGeneratedGlobalDefinitions(source).map(d => d.symbol);
  const rows: ControlSweepRow[] = shapes.variants.map(variant => {
    const path = join(candidates, `${variant.id}.c`); writeFileSync(path, variant.source);
    const row: ControlSweepRow = { id: variant.id, form: variant.form, source: projectPath(path) };
    try {
      const policy = validateVariantSource(variant.source, { inheritedGeneratedGlobals });
      if (policy.length) throw new Error(policy.map(p => p.message).join("; "));
      row.trace = jumpTrace(functionName, path);
    } catch (error) { row.error = (error as Error).message; }
    return row;
  });
  const successful = rows.filter(row => !row.error);
  if (successful.length) {
    /* The iteration primitive owns scoring and ledger publication. All sources
       are complete and compiled serially by the ordinary production pipeline. */
    const output = runTool("npx", ["tsx", join(ROOT, "tools/agent/residualObjective.ts"), functionName,
      ...(successful.length === rows.length ? ["--dir", candidates] : successful.flatMap(row => ["--source", resolve(ROOT, row.source)])),
      ...(block !== undefined ? ["--block", String(block)] : []), "--json"]);
    writeFileSync(join(directory, "residual.json"), output);
    const scored = JSON.parse(output) as { entries: Array<{ source?: string; objective: ResidualObjective }> };
    for (const row of successful) {
      const objective = scored.entries.find(e => e.source && resolve(ROOT, e.source) === resolve(ROOT, row.source))?.objective;
      if (objective) row.objective = objective;
      else row.error = "residualObjective returned no row for this source";
    }
  }
  rows.sort((a, b) => a.objective && b.objective ? compareObjectives(a.objective, b.objective, block === undefined ? {} : { block }) || a.id.localeCompare(b.id) : Number(!a.objective) - Number(!b.objective) || a.id.localeCompare(b.id));
  const inputStable = sha256(readFileSync(sourcePath, "utf8")) === sourceHash && sha256(readFileSync(preprocessOnly(sourcePath, contextDirectory, "input-check"), "utf8")) === contextHash;
  const report = { schemaVersion: 1, functionName, source: projectPath(sourcePath), sourceHash, contextHash, targetHash, implementation, frontend: C_FRONTEND_IDENTITY,
    baseline: baseline.report.objective, directory: projectPath(directory), inputStable, block, site: shapes.site, coverage: { total: shapes.total, evaluated: rows.length, exhaustive: shapes.exhaustive, failed: rows.filter(r => r.error).length },
    exact: inputStable ? rows.filter(r => r.objective?.exact && !r.error).map(r => r.source) : [], variants: rows };
  writeStableJson(join(directory, "report.json"), report);
  if (!inputStable) throw new Error(`source/header drift; preserved measurements at ${report.directory}, no result is promotion-eligible`);
  return report;
}
function main() {
  try {
    const args = process.argv.slice(2); let fn: string | undefined, source: string | undefined; let max = 64, json = false;
    for (let i = 0; i < args.length; i++) {
      const arg = args[i]!;
      if (arg === "--source") { source = args[++i]; if (!source) throw new Error("--source needs a path"); }
      else if (arg === "--max") max = Number(args[++i]);
      else if (arg === "--json") json = true;
      else if (arg.startsWith("--") || fn) throw new Error(`unexpected argument ${arg}`); else fn = normalizeFunctionName(arg);
    }
    if (!fn || !source) throw new Error("name a function and a source");
    const report = controlShapeSweep(fn, source, max);
    if (json) { console.log(JSON.stringify(report, null, 2)); return; }
    console.log(`control-shape sweep: ${fn}, tail at line ${report.site.line}, located block ${report.block ?? "undetermined"}`);
    console.log(`COVERAGE: ${report.coverage.evaluated}/${report.coverage.total}, ${report.coverage.exhaustive ? "EXHAUSTIVE" : "BOUNDED — not exhaustive"}, ${report.coverage.failed} failed`);
    for (const row of report.variants) console.log(`  ${row.id} ${row.form}: ${row.objective?.exact ? "EXACT" : row.objective?.key.join("/") ?? "unmeasured"} — ` +
      (row.trace?.passes[0]?.changes.slice(-2).map(c => `${c.classification}${c.rule ? ` (${c.rule})` : ""}`).join(", ") ?? row.error));
    console.log(`REPORT: ${report.directory}/report.json\nCandidates stay under build/; EXACT is not integration or finalization.`);
  } catch (error) { console.error(`controlShapeSweep: ${(error as Error).message}\nUsage: npx tsx tools/agent/controlShapeSweep.ts <fn> --source path [--max N] [--json]`); process.exitCode = 1; }
}
if (import.meta.url === `file://${process.argv[1]}`) main();
