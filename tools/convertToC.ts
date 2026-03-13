/**
 * convertToC.ts
 *
 * Converts `asm` subsegments in configs/splat.yaml to `c` subsegments,
 * enabling incremental decompilation via INCLUDE_ASM stubs.
 *
 * Usage:
 *   npx tsx tools/convertToC.ts           # dry run (default)
 *   npx tsx tools/convertToC.ts --write   # apply changes
 */

import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const SPLAT_YAML = join(ROOT, "configs/splat.yaml");

const writeMode = process.argv.includes("--write");

const lines = readFileSync(SPLAT_YAML, "utf-8").split("\n");

// Match lines like:  - [0x1A78, asm]       # 0x80011278 __start
const asmRegex = /^(\s*-\s*\[0x[0-9A-Fa-f]+),\s*asm\]\s*#\s*(0x[0-9A-Fa-f]+)\s+(\S+)/;

let converted = 0;
const newLines: string[] = [];

for (const line of lines) {
  const match = line.match(asmRegex);
  if (match) {
    const [, prefix, vram, funcName] = match;
    const newLine = `${prefix}, c, ${funcName}]       # ${vram} ${funcName}`;
    newLines.push(newLine);
    converted++;
    if (!writeMode) {
      console.log(`  ${line.trim()}`);
      console.log(`→ ${newLine.trim()}`);
      console.log();
    }
  } else {
    newLines.push(line);
  }
}

console.log(`${writeMode ? "Converted" : "Would convert"}: ${converted} asm → c segments`);

if (writeMode) {
  writeFileSync(SPLAT_YAML, newLines.join("\n"));
  console.log(`Wrote ${SPLAT_YAML}`);
}
