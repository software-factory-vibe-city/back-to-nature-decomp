/**
 * m2cFunc.ts — Run m2c on a single function's .s file
 *
 * Usage:
 *   npx tsx tools/m2cFunc.ts func_80011F08              # print C to stdout
 *   npx tsx tools/m2cFunc.ts func_80011F08 --write      # write to src/func_80011F08.c
 *   npx tsx tools/m2cFunc.ts func_80011F08 --context include/functions.h
 */

import { execSync } from "child_process";
import { existsSync, writeFileSync, mkdirSync, readdirSync } from "fs";
import { join, dirname } from "path";

const ROOT = new URL("..", import.meta.url).pathname;

const args = process.argv.slice(2);
const writeMode = args.includes("--write");
const ctxIdx = args.indexOf("--context");
const contextFile = ctxIdx >= 0 ? args[ctxIdx + 1] : null;
const funcName = args.find((a) => !a.startsWith("--") && a !== contextFile);

if (!funcName) {
  console.error("Usage: npx tsx tools/m2cFunc.ts <func_name> [--write] [--context <file>]");
  process.exit(1);
}

const asmDir = join("build/asm/nonmatchings", funcName);
let sFile = join(asmDir, `${funcName}.s`);
const cFile = join("src", `${funcName}.c`);

// If the expected .s file doesn't exist, look for the actual .s in the directory
// (handles named symbols like __start whose .s uses the address-based name)
if (!existsSync(join(ROOT, sFile))) {
  const absDir = join(ROOT, asmDir);
  if (existsSync(absDir)) {
    const files = readdirSync(absDir).filter((f) => f.endsWith(".s"));
    if (files.length === 1) {
      sFile = join(asmDir, files[0]);
    }
  }
}

if (!existsSync(join(ROOT, sFile))) {
  console.error(`Assembly file not found: ${sFile}`);
  process.exit(1);
}

// Derive the m2c function label from the .s filename (may differ from funcName)
const sBasename = sFile.split("/").pop()!.replace(/\.s$/, "");

// Build m2c command
const cmd = [
  "python3", "tools/m2c/m2c.py",
  "--target", "mipsel-gcc-c",
  "-f", sBasename,
];

// Auto-detect context header
const autoContext = join(ROOT, "include/functions.h");
if (contextFile) {
  cmd.push("--context", contextFile);
} else if (existsSync(autoContext)) {
  cmd.push("--context", "include/functions.h");
}

cmd.push(sFile);

let m2cOutput: string;
try {
  m2cOutput = execSync(cmd.join(" "), { cwd: ROOT, encoding: "utf-8" });
} catch (e: any) {
  console.error("m2c failed:", e.stderr || e.message);
  process.exit(1);
}

// Wrap in standard template
const output = [
  '#include "common.h"',
  "",
  m2cOutput.trim(),
  "",
].join("\n");

if (writeMode) {
  mkdirSync(join(ROOT, "src"), { recursive: true });
  writeFileSync(join(ROOT, cFile), output);
  console.log(`Wrote ${cFile}`);
} else {
  process.stdout.write(output);
}
