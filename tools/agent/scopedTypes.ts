/** Scope-aware context-only names; compiler headers are never populated here. */
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { isAbsolute, join, relative } from "node:path";
import { collectTypedefs, extractSignaturesFromSource } from "./sdkTypes.js";
import { parseC, walk, namedChildren, field } from "./residual-source-search/tree-sitter-c.js";
import { configuredCppFlags, ROOT } from "./decompToolchain.js";
import { analyzeCSource } from "./cSourceGuard.js";
import { scopeFromPreprocessed } from "./calleeTruth.js";

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
export function scopedTypeCatalog(root: string): {
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
    const output = execFileSync("mips-linux-gnu-cpp", [...flags, path], { cwd: root, encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
    return scopeFromPreprocessed(output);
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
    const tree = parseC(processed.source);
    for (const node of namedChildren(tree.rootNode)) {
      const origin = processed.lineOf(node.startPosition.row).file;
      if (excluded(origin)) continue;
      const local = new Map<string, string>(); collectTypedefs(node.text, local);
      for (const [name, text] of local) publicType(name, text, isAbsolute(origin) ? relative(root, origin) : origin);
      const type = ["struct_specifier", "union_specifier", "enum_specifier"].includes(node.type) ? node : field(node, "type");
      const tag = type ? field(type, "name") : undefined;
      if (type && tag && field(type, "body")) publicType(`${type.type.split("_")[0]} ${tag.text}`, `${type.text};`, origin);
    }
    tree.delete();
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
      const tree = parseC(processed.source);
      for (const node of namedChildren(tree.rootNode)) {
        const origin = processed.lineOf(node.startPosition.row).file;
        if (!origin.endsWith(".c") || node.type === "function_definition") continue;
        collectTypedefs(node.text, local);
        const type = ["struct_specifier", "union_specifier", "enum_specifier"].includes(node.type) ? node : field(node, "type");
        const tag = type ? field(type, "name") : undefined;
        if (type && tag) {
          localTags.add(tag.text);
          if (node.type !== "type_definition") standalone.set(`${type.type.split("_")[0]} ${tag.text}`, `${type.text};`);
        }
      }
      tree.delete();
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
