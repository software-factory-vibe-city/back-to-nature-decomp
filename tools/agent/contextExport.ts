/**
 * contextExport.ts — Extract function signatures from decompiled C files into include/functions.h
 *
 * Stage 4 of the decompilation pipeline. After a function is byte-matched and cleaned up,
 * this tool extracts its signature and adds it to include/functions.h so that future
 * m2c runs and LLM agents have type context.
 *
 * Usage:
 *   npx tsx tools/agent/contextExport.ts func_80011F08          # extract from src/func_80011F08.c
 *   npx tsx tools/agent/contextExport.ts --all                   # extract from all decompiled src/*.c
 *   npx tsx tools/agent/contextExport.ts func_80011F08 --dry-run # show what would be added
 */

import { readFileSync, writeFileSync, existsSync, readdirSync } from "fs";
import { join } from "path";

const ROOT = new URL("../..", import.meta.url).pathname;

// Match a C function definition: return type, name, params, opening brace.
// Handles pointer return types with the star on either side (`int* f`,
// `int *f`), multi-word types (unsigned int), and multi-line parameter
// lists. The separator group must contain a star or whitespace so that
// single-word statements (`if (x) {`) cannot match.
const FUNC_DEF_RE = /^([\w][\w\s]*?)(\s*\*+\s*|\s+)([\w]+)\s*\(([^)]*)\)\s*\{/gm;

// Lines that are not function definitions
const SKIP_RE = /^(?:#include|\/\/|\/\*|\*|$)/;

// Match typedef struct { ... } Name; — no nesting, C89 anonymous structs
const STRUCT_TYPEDEF_RE = /typedef\s+struct\s*\{[^}]*\}\s*(\w+)\s*;/gs;

// Built-in types that don't need struct definitions
const BUILTIN_TYPES = new Set([
  "u8", "u16", "u32", "s8", "s16", "s32",
  "vu8", "vu16", "vu32", "vs8", "vs16", "vs32",
  "char", "int", "short", "long", "void", "unsigned", "signed",
]);

interface ExportResult {
  signatures: string[];
  skipped: boolean;
  reason?: string;
}

/**
 * Extract function signatures from a decompiled C file.
 */
export function extractSignatures(cFilePath: string): string[] {
  if (!existsSync(cFilePath)) return [];

  const source = readFileSync(cFilePath, "utf-8");

  // Skip stubs that still use INCLUDE_ASM
  if (source.includes("INCLUDE_ASM(")) return [];

  const signatures: string[] = [];
  let match: RegExpExecArray | null;

  // Reset regex state
  FUNC_DEF_RE.lastIndex = 0;

  while ((match = FUNC_DEF_RE.exec(source)) !== null) {
    const returnType = match[1].trim();
    const stars = (match[2].match(/\*+/) ?? [""])[0];
    const funcName = match[3];
    const params = match[4].trim();

    // Normalize empty params to void; collapse multi-line params to single line
    const normalizedParams = params === "" ? "void" : params.replace(/\s+/g, " ").trim();
    signatures.push(`${returnType}${stars ? ` ${stars}` : ""} ${funcName}(${normalizedParams});`);
  }

  return signatures;
}

/**
 * Extract struct typedefs from a C source file.
 * Returns a map of type name -> full typedef text.
 */
export function extractStructTypedefs(cFilePath: string): Map<string, string> {
  const defs = new Map<string, string>();
  if (!existsSync(cFilePath)) return defs;

  const source = readFileSync(cFilePath, "utf-8");
  STRUCT_TYPEDEF_RE.lastIndex = 0;

  let match: RegExpExecArray | null;
  while ((match = STRUCT_TYPEDEF_RE.exec(source)) !== null) {
    defs.set(match[1], match[0]);
  }
  return defs;
}

/**
 * Given all signatures and all struct defs, find which struct names are referenced
 * in any signature. Computes transitive closure (struct fields referencing other structs).
 */
function findReferencedTypes(
  signatures: Map<string, string>,
  structDefs: Map<string, string>,
): Set<string> {
  const referenced = new Set<string>();

  // Find struct names referenced directly in signatures
  const allSigText = [...signatures.values()].join("\n");
  for (const name of structDefs.keys()) {
    if (allSigText.includes(name)) {
      referenced.add(name);
    }
  }

  // Transitive closure: if a referenced struct's body mentions another struct, include it
  let changed = true;
  while (changed) {
    changed = false;
    for (const name of referenced) {
      const body = structDefs.get(name)!;
      for (const candidate of structDefs.keys()) {
        if (!referenced.has(candidate) && body.includes(candidate)) {
          referenced.add(candidate);
          changed = true;
        }
      }
    }
  }

  return referenced;
}

/**
 * Collect struct typedefs from all source files in src/.
 */
function collectAllStructDefs(srcDir: string): Map<string, string> {
  const allDefs = new Map<string, string>();
  if (!existsSync(srcDir)) return allDefs;

  const files = readdirSync(srcDir).filter((f) => f.endsWith(".c"));
  for (const file of files) {
    const defs = extractStructTypedefs(join(srcDir, file));
    for (const [name, def] of defs) {
      allDefs.set(name, def);
    }
  }

  /* Also scan shared headers for struct typedefs */
  const includeDir = join(srcDir, "..", "include");
  const sharedHeaders = ["game_types.h"];
  for (const header of sharedHeaders) {
    const defs = extractStructTypedefs(join(includeDir, header));
    for (const [name, def] of defs) {
      allDefs.set(name, def);
    }
  }

  return allDefs;
}

/**
 * Read the current include/functions.h and return a map of funcName -> signature line.
 * Uses a regex over the full file content to correctly handle multi-line signatures.
 */
function readExistingHeader(headerPath: string): Map<string, string> {
  const map = new Map<string, string>();
  if (!existsSync(headerPath)) return map;

  const content = readFileSync(headerPath, "utf-8");
  // Match complete signatures: "type funcname(params);" — [
  const sigRe = /^[\w][\w\s]*?\s*\**\s*([\w]+)\s*\([^)]*\)\s*;\s*/gm;
  let m;
  while ((m = sigRe.exec(content)) !== null) {
    const funcName = m[1];
    // Normalize to single line: collapse whitespace inside params
    const sig = m[0].replace(/\s+/g, " ").trim();
    map.set(funcName, sig);
  }
  return map;
}

/**
 * Build a dependency graph of struct types: for each struct, find which other
 * struct names appear in its body. Returns a map name -> Set of dependency names.
 */
function buildStructDeps(
  structDefs: Map<string, string>,
): Map<string, Set<string>> {
  const deps = new Map<string, Set<string>>();
  for (const [name, body] of structDefs) {
    const depSet = new Set<string>();
    for (const candidate of structDefs.keys()) {
      if (candidate !== name && body.includes(candidate)) {
        depSet.add(candidate);
      }
    }
    deps.set(name, depSet);
  }
  return deps;
}

/**
 * Topological sort of struct typedefs so that dependencies are emitted first.
 * Falls back to alphabetical order for any remaining ties or cycles.
 */
function topologicalSortStructs(
  structDefs: Map<string, string>,
  referenced: Set<string>,
): string[] {
  const filtered = new Map<string, string>();
  for (const name of referenced) {
    if (structDefs.has(name)) {
      filtered.set(name, structDefs.get(name)!);
    }
  }

  const deps = buildStructDeps(filtered);
  const result: string[] = [];
  const visited = new Set<string>();
  const visiting = new Set<string>();

  function visit(name: string): void {
    if (visited.has(name)) return;
    if (visiting.has(name)) {
      // Cycle detected — skip to avoid infinite recursion
      return;
    }
    visiting.add(name);
    const depSet = deps.get(name) ?? new Set();
    for (const dep of depSet) {
      if (filtered.has(dep)) {
        visit(dep);
      }
    }
    visiting.delete(name);
    visited.add(name);
    result.push(name);
  }

  // Visit in alphabetical order for deterministic tie-breaking
  const names = [...filtered.keys()].sort();
  for (const name of names) {
    visit(name);
  }

  return result;
}

/**
 * Write include/functions.h with sorted signatures and any referenced struct typedefs.
 * Structs are emitted in dependency order (topological sort) so forward references work.
 */
function writeHeader(
  headerPath: string,
  signatures: Map<string, string>,
  structDefs: Map<string, string> = new Map(),
): void {
  // Sort by function name (which sorts by address for func_XXXXXXXX names)
  const sortedSigs = [...signatures.entries()].sort((a, b) => a[0].localeCompare(b[0]));

  // Filter to only structs referenced in signatures
  const referenced = findReferencedTypes(signatures, structDefs);
  const orderedStructNames = topologicalSortStructs(structDefs, referenced);

  // No preprocessor directives — m2c parses this as plain C context
  const lines = [
    "/* Auto-generated by tools/agent/contextExport.ts — do not edit manually */",
    "",
    "typedef unsigned char u8;",
    "typedef unsigned short u16;",
    "typedef unsigned int u32;",
    "typedef signed char s8;",
    "typedef signed short s16;",
    "typedef signed int s32;",
    "",
    // PSY-Q GPU types used in function signatures (opaque stubs for m2c context)
    "typedef unsigned long u_long;",
    "typedef struct { unsigned long pad[4]; } POLY_FT4;",
    "typedef struct { unsigned long pad[2]; } SPRT;",
    "typedef struct { unsigned long pad[1]; } DR_MODE;",
    "typedef struct { unsigned short x; unsigned short y; } RECT;",
    "typedef struct { unsigned long pad[3]; } TILE_1;",
    "typedef struct { unsigned long pad[4]; } TILE;",
    "typedef struct { unsigned long pad[4]; } LINE_F2;",
    "",
  ];

  if (orderedStructNames.length > 0) {
    for (const name of orderedStructNames) {
      lines.push(structDefs.get(name)!);
      lines.push("");
    }
  }

  lines.push(...sortedSigs.map(([_, sig]) => sig));
  lines.push("");

  writeFileSync(headerPath, lines.join("\n"));
}

/**
 * Export context for a single function. Returns extracted signatures.
 * This is the entry point used by the orchestrator.
 */
export function exportContext(funcName: string, rootDir: string = ROOT): ExportResult {
  const cFile = join(rootDir, "src", `${funcName}.c`);

  if (!existsSync(cFile)) {
    return { signatures: [], skipped: true, reason: "file not found" };
  }

  const sigs = extractSignatures(cFile);
  if (sigs.length === 0) {
    return { signatures: [], skipped: true, reason: "no function definitions (stub?)" };
  }

  /* A matched caller may carry its own local prototype for this function
   * (period style: per-file declarations, often with all-s32 parameter
   * lists that the caller's byte match depends on). Publishing a
   * conflicting prototype in functions.h would break those TUs, so skip
   * and report instead of writing. */
  const srcDirGuard = join(rootDir, "src");
  const declRe = new RegExp(`^[^/]*\\b${funcName}\\s*\\([^)]*\\)\\s*;`, "m");
  const conflicting = readdirSync(srcDirGuard)
    .filter((f) => f.endsWith(".c") && f !== `${funcName}.c`)
    .filter((f) => declRe.test(readFileSync(join(srcDirGuard, f), "utf-8")));
  if (conflicting.length > 0) {
    return {
      signatures: sigs,
      skipped: true,
      reason: `local prototype(s) exist in ${conflicting.join(", ")}; not publishing to functions.h (reconcile manually if desired)`,
    };
  }

  const headerPath = join(rootDir, "include/functions.h");
  const existing = readExistingHeader(headerPath);

  // Merge new signatures into existing
  for (const sig of sigs) {
    const m = sig.match(/^[\w][\w\s]*?\s*\**\s*([\w]+)\s*\(/);
    if (m) {
      existing.set(m[1], sig);
    }
  }

  // Collect struct defs from ALL source files (a signature in file A may reference a struct from file B)
  const srcDir = join(rootDir, "src");
  const allStructDefs = collectAllStructDefs(srcDir);

  writeHeader(headerPath, existing, allStructDefs);
  return { signatures: sigs, skipped: false };
}

/**
 * Export context for all decompiled (non-stub) C files in src/.
 */
export function exportAll(rootDir: string = ROOT): { exported: string[]; skipped: string[] } {
  const srcDir = join(rootDir, "src");
  if (!existsSync(srcDir)) return { exported: [], skipped: [] };

  const files = readdirSync(srcDir).filter((f) => f.endsWith(".c"));
  const exported: string[] = [];
  const skipped: string[] = [];

  // Collect all signatures and struct defs
  const headerPath = join(rootDir, "include/functions.h");
  const allSigs = readExistingHeader(headerPath);
  const allStructDefs = new Map<string, string>();

  for (const file of files) {
    const funcName = file.replace(/\.c$/, "");
    const cFile = join(srcDir, file);
    const sigs = extractSignatures(cFile);

    // Collect struct defs from every file
    const defs = extractStructTypedefs(cFile);
    for (const [name, def] of defs) {
      allStructDefs.set(name, def);
    }

    if (sigs.length === 0) {
      skipped.push(funcName);
      continue;
    }

    for (const sig of sigs) {
      const m = sig.match(/^[\w][\w\s]*?\s*\**\s*([\w]+)\s*\(/);
      if (m) {
        allSigs.set(m[1], sig);
      }
    }
    exported.push(funcName);
  }

  /* Also scan shared headers for struct typedefs */
  const includeDir = join(rootDir, "include");
  for (const header of ["game_types.h"]) {
    const defs = extractStructTypedefs(join(includeDir, header));
    for (const [name, def] of defs) {
      allStructDefs.set(name, def);
    }
  }

  if (exported.length > 0) {
    writeHeader(headerPath, allSigs, allStructDefs);
  }

  return { exported, skipped };
}

// --- CLI ---

if (process.argv[1]?.endsWith("contextExport.ts")) {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const all = args.includes("--all");
  const funcName = args.find((a) => !a.startsWith("--"));

  if (!all && !funcName) {
    console.error("Usage: npx tsx tools/agent/contextExport.ts <func_name> [--dry-run]");
    console.error("       npx tsx tools/agent/contextExport.ts --all [--dry-run]");
    process.exit(1);
  }

  if (all) {
    if (dryRun) {
      const srcDir = join(ROOT, "src");
      const files = readdirSync(srcDir).filter((f) => f.endsWith(".c"));
      const allSigs = new Map<string, string>();
      const allStructDefs = new Map<string, string>();
      for (const file of files) {
        const cFile = join(srcDir, file);
        const sigs = extractSignatures(cFile);
        for (const sig of sigs) {
          const m = sig.match(/^[\w][\w\s]*?\s*\**\s*([\w]+)\s*\(/);
          if (m) allSigs.set(m[1], sig);
        }
        const defs = extractStructTypedefs(cFile);
        for (const [name, def] of defs) {
          allStructDefs.set(name, def);
        }
      }
      const referenced = findReferencedTypes(allSigs, allStructDefs);
      const orderedNames = topologicalSortStructs(allStructDefs, referenced);
      if (orderedNames.length > 0) {
        console.log("/* Struct typedefs */");
        for (const name of orderedNames) {
          console.log(allStructDefs.get(name)!);
          console.log();
        }
      }
      console.log("/* Function signatures */");
      const sortedSigs = [...allSigs.entries()].sort((a, b) => a[0].localeCompare(b[0]));
      for (const [_, sig] of sortedSigs) {
        console.log(sig);
      }
      console.log(`\n${sortedSigs.length} signature(s), ${referencedDefs.length} struct(s) found (dry run, nothing written)`);
    } else {
      const result = exportAll();
      console.log(`Exported ${result.exported.length} function(s), skipped ${result.skipped.length} stub(s)`);
      if (result.exported.length > 0) {
        console.log(`Updated include/functions.h`);
      }
    }
  } else {
    const cFile = join(ROOT, "src", `${funcName}.c`);
    const sigs = extractSignatures(cFile);

    if (sigs.length === 0) {
      console.log(`No function definitions found in src/${funcName}.c (stub or missing)`);
      process.exit(0);
    }

    for (const sig of sigs) {
      console.log(`  ${sig}`);
    }

    if (dryRun) {
      console.log(`(dry run, nothing written)`);
    } else {
      const result = exportContext(funcName!);
      if (!result.skipped) {
        console.log(`Updated include/functions.h`);
      } else if (result.reason) {
        console.log(`Skipped: ${result.reason}`);
      }
    }
  }
}
