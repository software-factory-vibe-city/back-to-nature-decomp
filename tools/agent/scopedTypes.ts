/** Scope-aware context-only names; compiler headers are never populated here. */
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { isAbsolute, join, relative } from "node:path";
import { collectTypedefs, extractSignaturesFromSource } from "./sdkTypes.js";
import { parseC, walk, namedChildren, field, C_FRONTEND_IDENTITY } from "./residual-source-search/tree-sitter-c.js";
import { configuredCppFlags, ROOT } from "./decompToolchain.js";
import { analyzeCSource } from "./cSourceGuard.js";
import { scopeFromPreprocessed } from "./calleeTruth.js";
import { cachedPreprocess, withPreprocessorMetadata } from "./preprocessedCache.js";
import { digest, fileDigest, readCache, writeCache } from "../lib/contentCache.js";

export function filesUnder(dir: string, extension: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))
    .flatMap((e) => e.isDirectory() ? filesUnder(join(dir, e.name), extension) : e.name.endsWith(extension) ? [join(dir, e.name)] : []);
}
export function renameTypeTokens(source: string, names: Map<string, string>): string {
  const edits: Array<{ start: number; end: number; text: string }> = [];
  const tree = parseC(source);
  walk(tree.rootNode, (n) => {
    if (n.type === "type_identifier" && names.has(n.text)) edits.push({ start: n.startIndex, end: n.endIndex, text: names.get(n.text)! });
    return true;
  });
  tree.delete();
  let result = source;
  for (const e of edits.sort((a, b) => b.start - a.start)) result = result.slice(0, e.start) + e.text + result.slice(e.end);
  return result;
}
interface TypeFact { name: string; text: string; origin: string; kind: "typedef" | "tag" | "standalone" }
function cachedTypeFacts(root: string, path: string, processed: ReturnType<typeof scopeFromPreprocessed>, sourceLocal: boolean): TypeFact[] {
  const implementation = ["scopedTypes.ts", "sdkTypes.ts", "calleeTruth.ts", "residual-source-search/tree-sitter-c.ts"].map((p) => fileDigest(join(ROOT, "tools/agent", p)));
  implementation.push(fileDigest(join(ROOT, "tools/vendor/tree-sitter-c/tree-sitter-c.wasm")), fileDigest(join(ROOT, "package-lock.json")));
  const key = digest(JSON.stringify([processed.identity, sourceLocal, implementation, C_FRONTEND_IDENTITY]));
  const cache = join(root, "build/cache/scoped-types", `${digest(path + sourceLocal)}.json`);
  const hit = readCache<TypeFact[]>(cache, key);
  if (hit) return hit;
  const result: TypeFact[] = [];
  const tree = parseC(processed.source);
  try {
    for (const node of namedChildren(tree.rootNode)) {
      const origin = processed.lineOf(node.startPosition.row).file;
      if (sourceLocal ? (!origin.endsWith(".c") || node.type === "function_definition") :
        /(?:^|\/)(?:functions|sdk_types)\.h$/.test(origin) || origin.includes("/overlays/")) continue;
      const local = new Map<string, string>(); collectTypedefs(node.text, local);
      for (const [name, text] of local) result.push({ name, text, origin: sourceLocal ? origin : isAbsolute(origin) ? relative(root, origin) : origin, kind: "typedef" });
      const type = ["struct_specifier", "union_specifier", "enum_specifier"].includes(node.type) ? node : field(node, "type");
      const tag = type ? field(type, "name") : undefined;
      if (type && tag && (sourceLocal || field(type, "body"))) result.push({ name: `${type.type.split("_")[0]} ${tag.text}`, text: `${type.text};`, origin,
        kind: sourceLocal && node.type === "type_definition" ? "tag" : "standalone" });
    }
  } finally { tree.delete(); }
  writeCache(cache, key, result);
  return result;
}
export function scopedTypeCatalog(root: string): ReturnType<typeof buildScopedTypeCatalog> {
  return withPreprocessorMetadata(() => buildScopedTypeCatalog(root));
}
function buildScopedTypeCatalog(root: string): {
  defs: Map<string, string>; byFunction: Map<string, Map<string, string>>;
  conflicts: Array<{ name: string; origins: string[] }>;
  excludedFunctions: Set<string>;
} {
  const defs = new Map<string, string>();
  const excludedFunctions = new Set<string>();
  const byFunction = new Map<string, Map<string, string>>();
  const origins = new Map<string, string>();
  const conflicts: Array<{ name: string; origins: string[] }> = [];
  const normalize = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\s+/g, "");
  const flags = configuredCppFlags().map((f) => f.startsWith(`-I${ROOT}/`) ? `-I${join(root, relative(ROOT, f.slice(2)))}` : f);
  const preprocess = (path: string) => {
    return scopeFromPreprocessed(cachedPreprocess(path, root, flags).text);
  };
  const publicType = (name: string, text: string, origin: string) => {
    if (defs.has(name) && normalize(defs.get(name)!) !== normalize(text)) {
      conflicts.push({ name, origins: [origins.get(name)!, origin] }); defs.delete(name); return;
    }
    if (!conflicts.some((c) => c.name === name)) { defs.set(name, text); origins.set(name, origin); }
  };
  const excluded = (path: string) => /(?:^|\/)(?:functions|sdk_types)\.h$/.test(path) || path.includes("/overlays/");
  for (const path of filesUnder(join(root, "include"), ".h")) {
    if (excluded(path)) continue;
    const processed = preprocess(path);
    for (const entry of cachedTypeFacts(root, path, processed, false)) publicType(entry.name, entry.text, entry.origin);
  }
  for (const path of filesUnder(join(root, "src"), ".c")) {
    const source = readFileSync(path, "utf8");
    if (source.includes("INCLUDE_ASM(")) {
      for (const site of analyzeCSource(source).includeAsm) excludedFunctions.add(site.symbol);
      continue;
    }
    const signatures = extractSignaturesFromSource(source);
    if (!signatures.length) continue;
    const rawLocal = new Map<string, string>(); collectTypedefs(source, rawLocal);
    const local = new Map<string, string>();
    const localTags = new Set<string>();
    const standalone = new Map<string, string>();
    if (rawLocal.size || source.includes("struct ") || source.includes("union ") || source.includes("enum ")) {
      const processed = preprocess(path);
      for (const entry of cachedTypeFacts(root, path, processed, true)) {
        if (entry.kind === "typedef") local.set(entry.name, entry.text);
        else {
          localTags.add(entry.name.split(" ")[1]!);
          if (entry.kind === "standalone") standalone.set(entry.name, entry.text);
        }
      }
    }
    const scope = createHash("sha256").update(relative(root, path)).digest("hex").slice(0, 12);
    const names = new Map([...new Set([...local.keys(), ...localTags])].map((name) => [name, `M2C_${scope}_${name}`]));
    for (const [name, text] of local) defs.set(names.get(name)!, renameTypeTokens(text, names));
    for (const [name, text] of standalone) {
      const [kind, tag] = name.split(" ");
      defs.set(`${kind} ${names.get(tag!)!}`, renameTypeTokens(text, names));
    }
    for (const signature of signatures) {
      if (byFunction.has(signature.name)) conflicts.push({ name: signature.name, origins: ["another defining source", relative(root, path)] });
      else byFunction.set(signature.name, names);
    }
  }
  return { defs, byFunction, conflicts, excludedFunctions };
}
export function projectScopedSignatures(signatures: Map<string, string>, catalog: ReturnType<typeof scopedTypeCatalog>): void {
  for (const [name, signature] of signatures) {
    const names = catalog.byFunction.get(name);
    if (names) signatures.set(name, renameTypeTokens(signature, names));
  }
}
