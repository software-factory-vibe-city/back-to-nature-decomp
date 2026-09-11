/**
 * repairM2c.ts — m2c-repair layer, via tree-sitter AST (not regex).
 *
 * Takes m2c's draft for one function and repairs it with what the
 * reconstruction engine already knows. Every finding comes from the
 * tree-sitter parse, never from a regex over the text.
 *
 * Three repair passes:
 *   1. Insert missing extern declarations for unreferenced D_XXXXXXXX symbols.
 *   2. Replace `?` unknown-type markers (tree-sitter ERROR nodes) with s32.
 *   3. Add engine type context (typedefs, externs) for recovered views.
 *
 * Usage:
 *   npx tsx tools/agent/repairM2c.ts <functionName> [--write] [--compile]
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT, compileSource } from "./decompToolchain.js";
import { requireFunctionLocation } from "../lib/symbolIndex.js";
import { compareFunction } from "../lib/functionOracle.js";
import { loadContainer } from "../lib/container.js";
import { children, parseC, field, namedChildren, declaratorName, type Node } from "./residual-source-search/tree-sitter-c.js";
import type { ResultBundle } from "./matching-reconstruction/types.js";

/**
 * Every global the project's generated headers already declare. m2c's output
 * includes "common.h", which pulls in globals.h and globals_override.h, so any
 * symbol declared there is in scope when m2c's draft is compiled — and m2c's
 * own guessed `extern` for the same symbol is a *conflict*, not a fix. Parsed
 * once per process from the two headers, via the AST (never a regex).
 */
let projectGlobalsCache: Set<string> | undefined;
function projectDeclaredGlobals(): Set<string> {
  if (projectGlobalsCache) return projectGlobalsCache;
  const declared = new Set<string>();
  for (const rel of ["include/globals.h", "include/globals_override.h"]) {
    const path = join(ROOT, rel);
    if (!existsSync(path)) continue;
    let tree;
    try { tree = parseC(readFileSync(path, "utf-8")); } catch { continue; }
    everyChild(tree.rootNode, (node) => {
      if (node.type !== "declaration") return;
      for (const d of namedChildren(node)) {
        const nameNode = declaratorName(d);
        if (nameNode && /^D_[0-9A-Fa-f]{8}$/.test(nameNode.text)) declared.add(nameNode.text);
      }
    });
  }
  projectGlobalsCache = declared;
  return declared;
}

interface M2cRepair {
  originalSource: string;
  repairedSource: string;
  repairs: string[];
}

/* ---- helpers --------------------------------------------------------------- */

/** Every child, anonymous tokens included — needed to see ERROR and MISSING. */
function everyChild(node: Node, visit: (item: Node) => void): void {
  visit(node);
  for (const child of children(node)) everyChild(child, visit);
}

/** Extract all extern declarations from engine sources. */
function engineExterns(result: ResultBundle): Map<string, string> {
  const map = new Map<string, string>();
  const sources = [result.bestEffort?.source, result.winner?.source].filter(Boolean) as string[];
  for (const src of sources) {
    const tree = parseC(src);
    everyChild(tree.rootNode, (node) => {
      if (node.type !== "declaration") return;
      const storage = namedChildren(node).find((c) => c.type === "storage_class_specifier");
      if (!storage || storage.text !== "extern") return;
      const decls = namedChildren(node).filter((c) =>
        c.type === "init_declarator" || c.type === "declarator" || c.type === "function_declarator",
      );
      for (const d of decls) {
        const name_node = field(d, "declarator")
          ?? namedChildren(d).find((c) => c.type === "identifier")
          ?? d;
        if (name_node && name_node.type === "identifier") {
          map.set(name_node.text, node.text.slice(0, node.text.lastIndexOf(name_node.text)).trim());
        }
      }
    });
  }
  return map;
}

/** Extract typedefs from engine sources. */
function engineTypedefs(result: ResultBundle): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const sources = [result.bestEffort?.source, result.winner?.source].filter(Boolean) as string[];
  for (const src of sources) {
    const tree = parseC(src);
    everyChild(tree.rootNode, (node) => {
      if (node.type !== "type_definition" && node.type !== "type_declaration") return;
      if (!node.text.includes("Recon")) return;
      if (seen.has(node.text)) return;
      seen.add(node.text);
      out.push(node.text);
    });
  }
  return out;
}

/* ---- repair passes -------------------------------------------------------- */

/**
 * Pass 1 — Insert missing extern declarations for D_XXXXXXXX globals.
 *
 * Walks the AST for identifier references that look like D_XXXXXXXX and
 * checks whether each is declared (extern, parameter, local, or typedef).
 * Undeclared ones get an `extern` line inserted.
 */
function passUndeclaredGlobals(source: string, engine: ResultBundle | null): { source: string; repairs: string[] } {
  const repairs: string[] = [];
  const lines = source.split("\n");

  /* Already repaired? Skip. */
  if (lines.some((l) => l.includes("repair: added extern") || l.includes("repair: removed extern"))) {
    return { source, repairs: ["already repaired — skipping pass 1"] };
  }

  const engineExt = engine ? engineExterns(engine) : new Map<string, string>();
  const projectDeclared = projectDeclaredGlobals();

  let tree;
  try { tree = parseC(source); } catch {
    return { source, repairs: ["parse failed — cannot AST-scan for undeclared globals"] };
  }

  /* m2c's own `extern D_XXXX;` lines. A symbol the project header also
   * declares is a CONFLICT (m2c guessed a type; the header has the real one) —
   * drop m2c's line and let common.h provide it. A symbol only m2c declares is
   * kept. */
  const m2cDeclared = new Set<string>();
  const dropRows = new Set<number>();
  everyChild(tree.rootNode, (node) => {
    if (node.type !== "declaration") return;
    if (!(node.firstChild?.type === "storage_class_specifier" && node.firstChild.text === "extern")) return;
    for (const d of namedChildren(node)) {
      const nameNode = declaratorName(d);
      if (!nameNode || !/^D_[0-9A-Fa-f]{8}$/.test(nameNode.text)) continue;
      m2cDeclared.add(nameNode.text);
      if (projectDeclared.has(nameNode.text)) {
        for (let r = node.startPosition.row; r <= node.endPosition.row; r++) dropRows.add(r);
        repairs.push(`removed extern for ${nameNode.text} — conflicts with project header declaration`);
      }
    }
  });

  /* D_XXXX symbols referenced (not in a declaration context). */
  const globalRefs = new Set<string>();
  everyChild(tree.rootNode, (node) => {
    if (node.type !== "identifier" || !/^D_[0-9A-Fa-f]{8}$/.test(node.text)) return;
    const parent = node.parent;
    if (parent && (parent.type === "declaration" || parent.type === "parameter_declaration" ||
        parent.type === "init_declarator" || parent.type === "field_declaration")) return;
    globalRefs.add(node.text);
  });

  /* Add a declaration only for a symbol NEITHER m2c nor the project headers
   * declare. Default to a scalar (`s32`), never `u8[]`: m2c uses these as
   * scalars (`sym = 0`), and an array type makes that assignment a hard error.
   * The engine's recovered type is preferred when it has one. */
  const toInsert: string[] = [];
  for (const sym of [...globalRefs].sort()) {
    if (projectDeclared.has(sym) || m2cDeclared.has(sym)) continue;
    const type = engineExt.get(sym);
    if (type) {
      toInsert.push(`extern ${type} ${sym};`);
      repairs.push(`added extern for ${sym} (engine type: ${type.trim()})`);
    } else {
      toInsert.push(`extern s32 ${sym};`);
      repairs.push(`added extern for ${sym} (scalar default: s32)`);
    }
  }

  if (dropRows.size === 0 && toInsert.length === 0) return { source, repairs };

  let newLines = lines.filter((_, i) => !dropRows.has(i));
  if (toInsert.length > 0) {
    let insertAt = 0;
    for (let i = 0; i < newLines.length; i++) {
      if (newLines[i]!.trimStart().startsWith("#include")) { insertAt = i + 1; continue; }
      if (newLines[i]!.trim() === "") continue;
      if (insertAt > 0) break;
      break;
    }
    newLines.splice(insertAt, 0, "", "/* ---- repair: added extern declarations ---- */", ...toInsert, "");
    repairs.push(`inserted ${toInsert.length} extern(s) after line ${insertAt}`);
  }
  return { source: newLines.join("\n"), repairs };
}

/**
 * Pass 2 — Replace `?` type markers with s32.
 *
 * tree-sitter cannot parse `?` as a type, so it produces ERROR or MISSING
 * nodes at the position. Locate these by walking for ERROR/MISSING nodes
 * whose text starts with `?`, and replace with `s32`.
 */
function passUnknownTypes(source: string): { source: string; repairs: string[] } {
  const repairs: string[] = [];
  let tree;
  try { tree = parseC(source); } catch {
    return { source, repairs: ["parse failed — cannot AST-scan for unknown types"] };
  }

  /* Collect replacement sites: line:col positions where an ERROR/MISSING
   * node contains `?`. */
  const sites: Array<{ line: number; col: number; length: number }> = [];

  everyChild(tree.rootNode, (node) => {
    if (node.type !== "ERROR" && !node.isMissing) return;
    const text = node.text;
    if (!text.includes("?")) return;
    /* Find the `?` within the error text. */
    const idx = text.indexOf("?");
    sites.push({
      line: node.startPosition.row,
      col: node.startPosition.column + idx,
      length: 1,
    });
    repairs.push(`? marker at line ${node.startPosition.row + 1}, col ${idx} — replacing with s32`);
  });

  if (sites.length === 0) return { source, repairs };

  /* Apply replacements in reverse order (so offsets don't shift). */
  const lines = source.split("\n");
  let text = source;
  for (const site of sites.sort((a, b) => (b.line - a.line) || (b.col - a.col))) {
    const lineStart = lines.slice(0, site.line).join("\n").length + (site.line > 0 ? 1 : 0);
    const pos = lineStart + site.col;
    text = text.slice(0, pos) + "s32" + text.slice(pos + site.length);
  }

  return { source: text, repairs };
}

/**
 * Pass 3 — Insert engine type context (typedefs, externs) that m2c's output
 * needs but does not have, deduplicating against what the source already
 * declares.
 */
function passTypeContext(source: string, engine: ResultBundle | null): { source: string; repairs: string[] } {
  if (!engine) return { source, repairs: ["no engine result — skipping type context"] };

  const repairs: string[] = [];
  const lines = source.split("\n");

  /* Parse the source to find what's already declared. */
  let tree;
  try { tree = parseC(source); } catch {
    return { source, repairs: ["parse failed — cannot AST-scan for existing types"] };
  }

  const existingDecls = new Set<string>();
  everyChild(tree.rootNode, (node) => {
    if ((node.type === "declaration" && node.firstChild?.type === "storage_class_specifier" &&
         node.firstChild?.text === "extern") ||
        node.type === "type_definition" || node.type === "type_declaration") {
      existingDecls.add(node.text);
    }
  });

  const typ = engineTypedefs(engine);
  const ext = engineExterns(engine);
  const missingTyp = typ.filter((t) => ![...existingDecls].some((e) => e.includes(t.match(/}\s*(\w+)/)?.[1] ?? "")));
  const projectDeclared = projectDeclaredGlobals();
  const missingExt = [...ext.entries()]
    .filter(([sym]) => !projectDeclared.has(sym) && ![...existingDecls].some((e) => e.includes(sym)))
    .map(([_, decl]) => decl + " " + _ + ";");

  if (missingTyp.length === 0 && missingExt.length === 0) return { source, repairs };

  /* Find insertion point after includes / extern block. */
  let insertAt = 0;
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i]!.trimStart();
    if (t.startsWith("#include") || t.startsWith("extern ")) { insertAt = i + 1; continue; }
    if (t === "") continue;
    if (insertAt > 0) break;
    break;
  }

  const block: string[] = ["", "/* ---- repair: engine type context ---- */"];
  if (missingTyp.length > 0) block.push(...missingTyp);
  if (missingExt.length > 0) block.push(...missingExt);
  block.push("");

  const newLines = [...lines];
  newLines.splice(insertAt, 0, ...block);
  repairs.push(`inserted ${missingTyp.length} typedef(s) and ${missingExt.length} extern(s)`);
  return { source: newLines.join("\n"), repairs };
}

/* ---- main repair ---------------------------------------------------------- */

export function repairM2c(functionName: string): M2cRepair {
  const srcPath = join(ROOT, "src", `${functionName}.c`);
  if (!existsSync(srcPath)) {
    return { originalSource: "", repairedSource: "", repairs: [`source not found: ${srcPath}`] };
  }

  const originalSource = readFileSync(srcPath, "utf-8");
  const repairs: string[] = [];

  /* Load engine analysis. */
  const engineResult = loadEngineResult(functionName);

  /* Pass 1: Undeclared globals. */
  const p1 = passUndeclaredGlobals(originalSource, engineResult);
  repairs.push(...p1.repairs);

  /* Pass 2: Unknown types. */
  const p2 = passUnknownTypes(p1.source);
  repairs.push(...p2.repairs);

  /* Pass 3: Engine type context. */
  const p3 = passTypeContext(p2.source, engineResult);
  repairs.push(...p3.repairs);

  return { originalSource, repairedSource: p3.source, repairs };
}

export function compileAndCompareRepaired(
  functionName: string,
  repairedSource: string,
): { verdict: string; matchedWords: number; totalWords: number; error?: string } {
  try {
    const location = requireFunctionLocation(functionName);
    const container = location.container;

    const outDir = join(ROOT, "build", "m2cRepair", functionName);
    mkdirSync(outDir, { recursive: true });
    const srcPath = join(outDir, `${functionName}.c`);
    writeFileSync(srcPath, repairedSource);

    const artifacts = compileSource(srcPath, join(outDir, "compiled"), functionName, {
      assemble: true,
      useOverrides: false,
      containerKind: container.kind,
    });

    if (!artifacts.object) {
      return { verdict: "error", matchedWords: 0, totalWords: 0, error: "no object file" };
    }

    const oracle = compareFunction(functionName, { objectPath: artifacts.object, container });
    const total = Math.max(oracle.targetWords.length, oracle.candidateWords.length);
    return { verdict: oracle.verdict, matchedWords: oracle.same, totalWords: total };
  } catch (error) {
    return { verdict: "error", matchedWords: 0, totalWords: 0, error: (error instanceof Error ? error.message : String(error)).slice(0, 500) };
  }
}

function loadEngineResult(functionName: string): ResultBundle | null {
  const p = join(ROOT, "build/matchingReconstruction", functionName, "result.json");
  if (!existsSync(p)) return null;
  try { return JSON.parse(readFileSync(p, "utf-8")) as ResultBundle; }
  catch { return null; }
}

function loadBestEffort(functionName: string): string | null {
  const p = join(ROOT, "build/matchingReconstruction", functionName, "best-effort.c");
  if (!existsSync(p)) return null;
  try { return readFileSync(p, "utf-8"); }
  catch { return null; }
}

function loadWinner(functionName: string): string | null {
  const p = join(ROOT, "build/matchingReconstruction", functionName, "winner.c");
  if (!existsSync(p)) return null;
  try { return readFileSync(p, "utf-8"); }
  catch { return null; }
}

/* ---- CLI ------------------------------------------------------------------ */

function main(): void {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error("usage: npx tsx tools/agent/repairM2c.ts <functionName> [--write] [--compile]");
    process.exit(1);
  }

  const functionName = args[0]!;
  const shouldWrite = args.includes("--write");
  const shouldCompile = args.includes("--compile");

  const result = repairM2c(functionName);
  console.log(`=== ${functionName}: m2c repair report ===`);
  console.log();

  if (result.originalSource === "") {
    console.error(result.repairs.join("\n"));
    process.exit(2);
  }

  for (const r of result.repairs) console.log(`  ${r}`);

  if (result.originalSource !== result.repairedSource) {
    const orig = result.originalSource.split("\n");
    const next = result.repairedSource.split("\n");
    let changed = 0;
    for (let i = 0; i < Math.max(orig.length, next.length); i++) {
      if (orig[i] !== next[i]) changed++;
    }
    console.log(`  ${changed} line(s) changed`);
  } else {
    console.log("  no changes needed");
  }
  console.log();

  if (shouldWrite && result.repairedSource !== result.originalSource) {
    const dst = join(ROOT, "src", `${functionName}.c`);
    writeFileSync(dst, result.repairedSource);
    console.log(`  wrote to ${dst}`);
  }

  if (shouldCompile && result.repairedSource !== "") {
    const comp = compileAndCompareRepaired(functionName, result.repairedSource);
    if (comp.error) console.log(`  COMPILE ERROR: ${comp.error}`);
    else console.log(`  VERDICT: ${comp.verdict} (${comp.matchedWords}/${comp.totalWords})`);
  }

  /* Check for engine candidates. */
  const winner = loadWinner(functionName);
  const best = loadBestEffort(functionName);
  if (winner) console.log(`  NOTE: engine EXACT match exists — use psx_finalize_function`);
  else if (best) console.log(`  NOTE: engine best-effort exists — compare with psx_residual_objective`);
}

if (process.argv[1]?.endsWith("repairM2c.ts")) main();