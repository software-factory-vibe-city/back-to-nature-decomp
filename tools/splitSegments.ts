/**
 * splitSegments.ts
 *
 * Reads splat-generated C files to discover sub-functions within segments,
 * then splits each into its own segment in splat.yaml so every function
 * gets a dedicated C file.
 *
 * Usage:
 *   npx tsx tools/splitSegments.ts           # dry run (default)
 *   npx tsx tools/splitSegments.ts --write   # apply changes
 */

import { readFileSync, writeFileSync, readdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { loadPsxExeInfo, ROOT } from "./psxExeInfo.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const _info = loadPsxExeInfo();
const SPLAT_YAML = join(ROOT, "configs/splat.yaml");
const SRC_DIR = join(ROOT, "src");

const VRAM_BASE = _info.loadAddr;
const FILE_OFFSET_BASE = _info.payloadOffset;

const writeMode = process.argv.includes("--write");

// Parse function names from a C file to get all functions in a segment
function getFuncsFromCFile(path: string): string[] {
  const content = readFileSync(path, "utf-8");
  const funcs: string[] = [];

  // Match auto-decompiled empty functions: void func_XXXX(void) {}
  for (const m of content.matchAll(/^void\s+(func_[0-9A-Fa-f]+|__\w+)\s*\(void\)\s*\{/gm)) {
    funcs.push(m[1]);
  }

  // Match INCLUDE_ASM calls
  for (const m of content.matchAll(/INCLUDE_ASM\("[^"]+",\s*(\w+)\)/g)) {
    funcs.push(m[1]);
  }

  return funcs;
}

// Convert a function name like func_80011EF0 to a file offset
function funcNameToOffset(name: string): number | null {
  const match = name.match(/(?:func_|__)([0-9A-Fa-f]{8})/);
  if (!match) return null;
  const vram = parseInt(match[1], 16);
  return vram - VRAM_BASE + FILE_OFFSET_BASE;
}

// For names like __start, look up from symbol_addrs or use known mappings
function funcNameToVram(name: string): number | null {
  const match = name.match(/^func_([0-9A-Fa-f]{8})$/);
  if (match) return parseInt(match[1], 16);
  if (name === "__start") return _info.entryPoint;
  return null;
}

// Read splat.yaml line by line
const yamlLines = readFileSync(SPLAT_YAML, "utf-8").split("\n");

// Match c segment lines
const cSegRegex = /^(\s*-\s*\[)(0x[0-9A-Fa-f]+)(,\s*c,\s*)(\S+?)(\]\s*#\s*)(0x[0-9A-Fa-f]+)\s+(\S+)$/;

let newSegments = 0;
const outputLines: string[] = [];

for (const line of yamlLines) {
  const match = line.match(cSegRegex);
  if (!match) {
    outputLines.push(line);
    continue;
  }

  const [, prefix, offsetStr, middle, segName, suffix, vramStr, commentName] = match;
  const indent = line.match(/^(\s*)/)?.[1] ?? "      ";

  // Read the corresponding C file
  const cFile = join(SRC_DIR, `${segName}.c`);
  let funcs: string[];
  try {
    funcs = getFuncsFromCFile(cFile);
  } catch {
    // File doesn't exist or can't be read, keep original line
    outputLines.push(line);
    continue;
  }

  if (funcs.length <= 1) {
    // Single function, keep as-is
    outputLines.push(line);
    continue;
  }

  // Multiple functions — emit one segment per function
  // Sort by VRAM address
  const sorted = funcs
    .map((name) => ({ name, vram: funcNameToVram(name) }))
    .filter((f): f is { name: string; vram: number } => f.vram !== null)
    .sort((a, b) => a.vram - b.vram);

  if (sorted.length <= 1) {
    outputLines.push(line);
    continue;
  }

  for (const func of sorted) {
    const offset = func.vram - VRAM_BASE + FILE_OFFSET_BASE;
    const offsetHex = `0x${offset.toString(16).toUpperCase()}`;
    const vramHex = `0x${func.vram.toString(16).toUpperCase()}`;
    const newLine = `${indent}- [${offsetHex}, c, ${func.name}]       # ${vramHex} ${func.name}`;
    outputLines.push(newLine);
  }

  newSegments += sorted.length - 1; // -1 because original segment already existed
  if (!writeMode) {
    console.log(`${segName}: ${funcs.length} functions → ${sorted.length} segments`);
  }
}

console.log(
  `${writeMode ? "Added" : "Would add"}: ${newSegments} new segments (${674 + newSegments} total)`
);

if (writeMode) {
  writeFileSync(SPLAT_YAML, outputLines.join("\n"));
  console.log(`Wrote ${SPLAT_YAML}`);
}
