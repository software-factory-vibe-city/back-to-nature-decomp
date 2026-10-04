import ts from "typescript";
import { spawn } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes } from "node:crypto";
import { canonical, hash, safePath, Store } from "./storage.ts";
import type { Request } from "./types.ts";

export const PARSER_CONFIG = "tools/agent/resource-extraction/parser-plugins.ts";
export const PARSER_ROOT = "tools/agent/resource-extraction/parsers/";
export function parserPath(path: string): boolean { return path === PARSER_CONFIG || new RegExp(`^${PARSER_ROOT}[a-z][a-z0-9-]*(?:\\.test)?\\.ts$`).test(path); }
interface Baseline { files: Record<string, string> }
function scopedFiles(root: string): string[] {
  const dir = safePath(root, PARSER_ROOT);
  return [PARSER_CONFIG, ...(existsSync(dir) ? readdirSync(dir).map(f => PARSER_ROOT + f).filter(parserPath) : [])].filter(p => existsSync(safePath(root, p))).sort();
}
function fingerprint(root: string, path: string): string | null { const absolute = safePath(root, path); return existsSync(absolute) ? hash(readFileSync(absolute)) : null; }
function registrations(text: string): Record<string, string> {
  const source = ts.createSourceFile(PARSER_CONFIG, text, ts.ScriptTarget.Latest, true);
  const imports = new Map<string, string>(), entries: string[] = [];
  let arrays = 0;
  for (const statement of source.statements) {
    if (ts.isEmptyStatement(statement)) continue;
    if (ts.isImportDeclaration(statement)) {
      if (!ts.isStringLiteral(statement.moduleSpecifier) || !statement.importClause) throw new Error("Registration requires explicit imports");
      const clause = statement.importClause, module = statement.moduleSpecifier.text;
      if (clause.isTypeOnly && module === "./registry.ts") continue;
      if (!/^\.\/parsers\/[a-z][a-z0-9-]*\.ts$/.test(module) || clause.name || !clause.namedBindings || !ts.isNamedImports(clause.namedBindings)) throw new Error("Registration imports only named parser plugins");
      for (const entry of clause.namedBindings.elements) {
        if (imports.has(entry.name.text)) throw new Error("Duplicate parser import");
        imports.set(entry.name.text, PARSER_ROOT + module.slice("./parsers/".length));
      }
      continue;
    }
    if (!ts.isVariableStatement(statement)) throw new Error("Parser registration permits imports and EXTRA_PARSERS only");
    if (!(statement.declarationList.flags & ts.NodeFlags.Const) || !statement.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword)) throw new Error("Registration must export const EXTRA_PARSERS");
    for (const declaration of statement.declarationList.declarations) {
      if (!ts.isIdentifier(declaration.name) || declaration.name.text !== "EXTRA_PARSERS" || !declaration.initializer || !ts.isArrayLiteralExpression(declaration.initializer)) throw new Error("Registration must be a literal EXTRA_PARSERS array");
      arrays++;
      for (const element of declaration.initializer.elements) {
        if (!ts.isIdentifier(element) || !imports.has(element.text)) throw new Error("Registration entries must be imported plugin identifiers");
        entries.push(element.text);
      }
    }
  }
  if (arrays !== 1 || new Set(entries).size !== entries.length) throw new Error("Missing/duplicate parser registrations");
  return Object.fromEntries(entries.map(name => [name, imports.get(name)!]));
}
function registrationNames(text: string): string[] { return Object.keys(registrations(text)); }
/** A narrow admission policy, not a claim of an OS sandbox against malicious
 * repository authors. The TUI has no shell tool; tests run with fixed argv. */
export function parserSourcePolicy(path: string, text: string): void {
  const source = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true);
  const errors = (source as ts.SourceFile & { parseDiagnostics: readonly ts.Diagnostic[] }).parseDiagnostics;
  if (errors.length) throw new Error(`Parser source does not parse: ${path}`);
  const test = path.endsWith(".test.ts");
  const banned = new Set(["process", "global", "globalThis", "eval", "Function", "require", "fetch", "WebSocket", "Deno", "Bun"]);
  function walk(node: ts.Node): void {
    if (ts.isIdentifier(node) && banned.has(node.text)) throw new Error(`Forbidden parser capability: ${node.text}`);
    if (ts.isPropertyAccessExpression(node) && ["constructor", "prototype", "__proto__"].includes(node.name.text)) throw new Error("Prototype/code-construction access refused");
    if (ts.isElementAccessExpression(node) && ts.isStringLiteral(node.argumentExpression) && ["constructor", "prototype", "__proto__"].includes(node.argumentExpression.text)) throw new Error("Prototype/code-construction access refused");
    if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) throw new Error("Dynamic imports refused in parser iterations");
    if (ts.isImportDeclaration(node)) {
      if (!ts.isStringLiteral(node.moduleSpecifier)) throw new Error("Nonliteral import");
      const spec = node.moduleSpecifier.text;
      const pureLocal = /^\.\/[a-z][a-z0-9-]*\.ts$/.test(spec) || spec === "../formats.ts";
      const types = node.importClause?.isTypeOnly && ["./registry.ts", "../registry.ts"].includes(spec);
      const tests = test && ["node:test", "node:assert/strict", "node:assert", "../registry.ts"].includes(spec);
      if (!pureLocal && !types && !tests && spec !== "node:buffer" && !(path === PARSER_CONFIG && /^\.\/parsers\/[a-z][a-z0-9-]*\.ts$/.test(spec))) throw new Error(`Parser import outside pure capability scope: ${spec}`);
    }
    if (ts.isExportDeclaration(node) && node.moduleSpecifier) throw new Error("Re-export imports refused");
    ts.forEachChild(node, walk);
  }
  walk(source);
  if (path === PARSER_CONFIG) registrationNames(text);
}
async function command(root: string, args: string[], signal?: AbortSignal): Promise<{ code: number; stdout: string; stderr: string }> {
  signal?.throwIfAborted();
  return new Promise((resolveResult, reject) => {
    // A parent node:test process marks descendants with NODE_TEST_CONTEXT;
    // inheriting it makes a nested --test silently skip every test with exit 0.
    const env = { ...process.env }; delete env.NODE_TEST_CONTEXT;
    const child = spawn(process.execPath, args, { cwd: root, env, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "", stderr = "", force: ReturnType<typeof setTimeout> | undefined;
    const cancel = (): void => { child.kill("SIGTERM"); force ??= setTimeout(() => child.kill("SIGKILL"), 2000); };
    const timer = setTimeout(cancel, 120000);
    signal?.addEventListener("abort", cancel);
    child.stdout.on("data", chunk => { stdout += chunk; if (stdout.length > 4 * 1024 * 1024) cancel(); });
    child.stderr.on("data", chunk => { stderr += chunk; if (stderr.length > 4 * 1024 * 1024) cancel(); });
    child.once("error", reject);
    child.once("close", code => { clearTimeout(timer); if (force) clearTimeout(force); signal?.removeEventListener("abort", cancel); resolveResult({ code: code ?? -1, stdout, stderr }); });
  });
}
export async function parserOperation(root: string, request: Request, signal?: AbortSignal): Promise<Record<string, unknown>> {
  const store = new Store(root);
  if (request.action === "prepare") {
    const files = Object.fromEntries(scopedFiles(root).map(p => [p, readFileSync(safePath(root, p), "utf8")]));
    const baseline: Baseline = { files };
    const token = randomBytes(12).toString("hex");
    store.json(`cache/parser-builder/baselines/${token}.json`, baseline);
    return { baseline: token, outcome: "prepared", allowed: [PARSER_CONFIG, PARSER_ROOT + "*.ts"], previousRegistrations: registrationNames(files[PARSER_CONFIG] ?? "") };
  }
  if (!request.baseline || !/^[a-f0-9]{24}$/.test(request.baseline)) throw new Error("Parser operation requires the prepared iteration baseline");
  if (request.action !== "test" && request.action !== "accept") throw new Error("Parser action must be prepare, test or accept; drafts are never automatically restored");
  const path = `cache/parser-builder/baselines/${request.baseline}.json`;
  const baseline = store.read<Baseline>(path);
  const candidates = [...new Set([...Object.keys(baseline.files), ...scopedFiles(root)])];
  const changed = candidates.filter(p => fingerprint(root, p) !== (baseline.files[p] === undefined ? null : hash(baseline.files[p]!)));
  // Only parser-source identity matters. Concurrent game-source edits, staged
  // work and Git HEAD changes are independent; this gate never reads/mutates Git.
  if (!changed.length) throw new Error("Parser work item must implement or improve a capability");
  for (const file of changed) {
    if (!existsSync(safePath(root, file))) throw new Error("Parser deletion is not an accepted capability");
    parserSourcePolicy(file, readFileSync(safePath(root, file), "utf8"));
  }
  const previousEntries = registrations(baseline.files[PARSER_CONFIG] ?? ""), currentEntries = registrations(readFileSync(safePath(root, PARSER_CONFIG), "utf8"));
  const previous = Object.keys(previousEntries), current = Object.keys(currentEntries);
  if (!previous.every(p => currentEntries[p] === previousEntries[p])) throw new Error("Existing parsers must remain registered");
  const implementations = changed.filter(p => p !== PARSER_CONFIG && !p.endsWith(".test.ts"));
  if (!implementations.length || implementations.some(p => !changed.includes(p.replace(/\.ts$/, ".test.ts")))) throw new Error("Each new parser needs a changed corresponding test file");
  if (current.filter(p => !previous.includes(p)).some(p => !implementations.includes(currentEntries[p]!))) throw new Error("New registrations must reference a changed parser implementation");
  const here = dirname(fileURLToPath(import.meta.url)), repository = resolve(here, "../../..");
  const tsx = resolve(repository, "node_modules/tsx/dist/cli.mjs"), tsc = resolve(repository, "node_modules/typescript/bin/tsc");
  const sourceHash = hash(canonical(scopedFiles(root).map(p => [p, fingerprint(root, p)])));
  const typecheck = await command(root, [tsc, "--noEmit", "--allowImportingTsExtensions", "--module", "nodenext", "--target", "esnext", "--typeRoots", resolve(repository, "node_modules/@types"), "--types", "node", "--strict", "--skipLibCheck", ...changed], signal);
  const coreTests = safePath(root, "tools/agent/resource-extraction/resource-extraction.test.ts");
  const results: Array<{ file: string; code: number; stdout: string; stderr: string; executed: number; passed: boolean }> = [];
  if (typecheck.code === 0) for (const file of [...scopedFiles(root).filter(p => p.endsWith(".test.ts")), existsSync(coreTests) ? coreTests : resolve(here, "resource-extraction.test.ts")]) {
    // Check every parser suite separately: a new capability must not regress
    // existing decoders, and core success cannot conceal an empty/skipped suite.
    const tested = await command(root, [tsx, "--test", "--test-reporter=tap", file], signal);
    const count = (label: string): number => Number(tested.stdout.match(new RegExp(`^# ${label} (\\d+)$`, "m"))?.[1] ?? 0);
    const executed = count("tests"), passed = tested.code === 0 && executed > 0 && count("pass") === executed && count("fail") === 0 && count("skipped") === 0 && count("cancelled") === 0 && count("todo") === 0;
    results.push({ file, ...tested, executed, passed });
  }
  const testsExecuted = results.reduce((sum, result) => sum + result.executed, 0);
  const report = { outcome: typecheck.code === 0 && results.length > 0 && results.every(result => result.passed) ? "tested" : "failed", baseline: request.baseline, changed, testsExecuted, sourceHash, typecheck, tests: results };
  signal?.throwIfAborted();
  if (hash(canonical(scopedFiles(root).map(p => [p, fingerprint(root, p)]))) !== sourceHash) throw new Error("Parser source drift during testing; refusing untested capability");
  store.json(`cache/parser-builder/tests/${request.baseline}.json`, report);
  if (report.outcome !== "tested" || request.action !== "accept") return report;
  return { ...report, outcome: "parser-tested", note: "Capability tested; source/drafts remain in place. No commit performed. Run extract-assets to exercise registered formats." };
}
