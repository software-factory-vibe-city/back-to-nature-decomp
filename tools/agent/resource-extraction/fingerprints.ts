import ts from "typescript";
import { existsSync, readFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { canonical, hash, safePath } from "./storage.ts";
import { PARSERS, TIM_PARSER, type ParserRegistry } from "./registry.ts";
import type { ParserFingerprint } from "./types.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const REGISTRY = "tools/agent/resource-extraction/registry.ts";
const PLUGINS = "tools/agent/resource-extraction/parser-plugins.ts";
export function engineFingerprints(root = ROOT): Array<{ path: string; hash: string }> {
  // Shared processors/publication code, independent of the plugin list. Parser
  // modules and their own transitive dependencies remain separate identities.
  const files = ["types.ts", "storage.ts", "pipeline.ts", "schema.ts", "analysis.ts", "presentation.ts", "provenance.ts", "fingerprints.ts"].map(name => `tools/agent/resource-extraction/${name}`);
  files.push(...dependencyFiles(root, "tools/agent/matching-reconstruction/decode.ts").map(f => f.path));
  for (const name of ["cfg.ts", "ssa.ts", "ir.ts", "dominance.ts"]) files.push(...dependencyFiles(root, `tools/agent/machine-ir/${name}`).map(f => f.path));
  return [...new Set(files)].sort().map(path => ({ path, hash: hash(readFileSync(safePath(root, path))) }));
}
/** Follow actual static implementation imports, not declared revision numbers or
 * the entire tools tree. Type-only references do not execute. Plugins are admitted
 * separately by the pure-source gate; an unresolved runtime dependency is an error. */
export function dependencyFiles(root: string, entry: string): Array<{ path: string; hash: string }> {
  const result = new Map<string, string>();
  function visit(path: string): void {
    if (result.has(path)) return;
    const bytes = readFileSync(safePath(root, path));
    result.set(path, hash(bytes));
    const source = ts.createSourceFile(path, bytes.toString(), ts.ScriptTarget.Latest, true);
    for (const statement of source.statements) {
      if (!ts.isImportDeclaration(statement) && !ts.isExportDeclaration(statement)) continue;
      if (!statement.moduleSpecifier || !ts.isStringLiteral(statement.moduleSpecifier)) continue;
      if (ts.isImportDeclaration(statement) && statement.importClause?.isTypeOnly) continue;
      if (ts.isExportDeclaration(statement) && statement.isTypeOnly) continue;
      const spec = statement.moduleSpecifier.text;
      if (spec.startsWith("node:")) continue;
      if (!spec.startsWith(".") || !/\.(ts|js)$/.test(spec)) throw new Error(`Unfingerprinted implementation dependency: ${spec}`);
      const requested = safePath(root, resolve(root, dirname(path), spec));
      // NodeNext sources may name .js while tsx resolves their actual .ts source.
      const target = existsSync(requested) ? requested : spec.endsWith(".js") ? safePath(root, requested.slice(0, -3) + ".ts") : requested;
      visit(relative(root, target).replaceAll("\\", "/"));
    }
  }
  visit(entry);
  return [...result].sort(([a], [b]) => a.localeCompare(b, "en")).map(([path, digest]) => ({ path, hash: digest }));
}
export function parserFingerprints(registry: ParserRegistry = PARSERS, root = ROOT): ParserFingerprint[] {
  const source = ts.createSourceFile(REGISTRY, readFileSync(safePath(root, REGISTRY), "utf8"), ts.ScriptTarget.Latest, true);
  const tim = source.statements.find(s => ts.isVariableStatement(s) && s.declarationList.declarations.some(d => ts.isIdentifier(d.name) && d.name.text === "TIM_PARSER"));
  // Registry validation/scan/decode code affects all parsers. TIM-specific code
  // and the plugin list do not: adding XA must not throw away TIM's negative scans.
  const common = source.statements.filter(s => s !== tim && !ts.isImportDeclaration(s) && !(ts.isVariableStatement(s) && s.declarationList.declarations.some(d => ts.isIdentifier(d.name) && ["PARSERS", "scanFormats"].includes(d.name.text)))).map(s => s.getText(source)).join("\n");
  const registryHash = hash(common);
  const pluginSource = ts.createSourceFile(PLUGINS, readFileSync(safePath(root, PLUGINS), "utf8"), ts.ScriptTarget.Latest, true);
  const plugins = new Map<string, string>();
  for (const statement of pluginSource.statements) if (ts.isImportDeclaration(statement) && !statement.importClause?.isTypeOnly && ts.isStringLiteral(statement.moduleSpecifier)) {
    const path = relative(root, safePath(root, resolve(root, dirname(PLUGINS), statement.moduleSpecifier.text))).replaceAll("\\", "/");
    // The registered object itself identifies its implementation module. Import
    // aliases and helper exports cannot accidentally fingerprint the wrong parser.
    const declared = PARSERS.parsers.filter(p => p !== TIM_PARSER);
    const entries = pluginSource.statements.filter(ts.isVariableStatement).flatMap(s => s.declarationList.declarations).find(d => ts.isIdentifier(d.name) && d.name.text === "EXTRA_PARSERS");
    const names = entries?.initializer && ts.isArrayLiteralExpression(entries.initializer) ? entries.initializer.elements.map(e => e.getText(pluginSource)) : [];
    const imported = statement.importClause?.namedBindings;
    if (imported && ts.isNamedImports(imported)) for (const binding of imported.elements) {
      const index = names.indexOf(binding.name.text);
      if (index >= 0 && declared[index]) plugins.set(declared[index]!.id, path);
    }
  }
  return registry.parsers.map(parser => {
    const files = dependencyFiles(root, parser === TIM_PARSER ? "tools/agent/resource-extraction/formats.ts" : plugins.get(parser.id) ?? (() => { throw new Error(`No implementation provenance for ${parser.id}`); })());
    files.push({ path: `${REGISTRY}#shared`, hash: registryHash });
    if (parser === TIM_PARSER) files.push({ path: `${REGISTRY}#TIM_PARSER`, hash: hash(tim!.getText(source)) });
    // integer/canonical are shared registry runtime dependencies.
    files.push({ path: "tools/agent/resource-extraction/storage.ts", hash: hash(readFileSync(safePath(root, "tools/agent/resource-extraction/storage.ts"))) });
    files.sort((a, b) => a.path.localeCompare(b.path, "en"));
    return { id: parser.id, format: parser.format, version: parser.version, hash: hash(canonical(files)), files, specifications: parser.specifications ?? [] };
  }).sort((a, b) => a.id.localeCompare(b.id, "en"));
}
