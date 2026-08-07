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

    // Normalize empty params to void
    const normalizedParams = params === "" ? "void" : params;
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
 */
function readExistingHeader(headerPath: string): Map<string, string> {
  const map = new Map<string, string>();
  if (!existsSync(headerPath)) return map;

  const content = readFileSync(headerPath, "utf-8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    // Match signature lines: "type funcname(...);" (star on either side)
    const m = trimmed.match(/^[\w][\w\s]*?\s*\**\s*([\w]+)\s*\(/);
    if (m) {
      map.set(m[1], trimmed);
    }
  }
  return map;
}

/**
 * Write include/functions.h with sorted signatures and any referenced struct typedefs.
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
  const sortedStructs = [...structDefs.entries()]
    .filter(([name]) => referenced.has(name))
    .sort((a, b) => a[0].localeCompare(b[0]));

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
  ];

  if (sortedStructs.length > 0) {
    for (const [_, def] of sortedStructs) {
      lines.push(def);
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
      const referencedDefs = [...allStructDefs.entries()]
        .filter(([name]) => referenced.has(name))
        .sort((a, b) => a[0].localeCompare(b[0]));
      if (referencedDefs.length > 0) {
        console.log("/* Struct typedefs */");
        for (const [_, def] of referencedDefs) {
          console.log(def);
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
