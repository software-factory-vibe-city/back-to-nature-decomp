/**
 * m2cFunc.ts — Run m2c on a single function's .s file
 *
 * Usage:
 *   npx tsx tools/m2cFunc.ts func_80011F08              # print C to stdout
 *   npx tsx tools/m2cFunc.ts func_80011F08 --write      # write to src/func_80011F08.c
 *   npx tsx tools/m2cFunc.ts func_80011F08 --context include/functions.h
 *
 * Importable:
 *   import { runM2c } from "./m2cFunc.js";
 *   const output = runM2c("func_80011F08", projectRoot);
 */

import { execSync } from "child_process";
import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync } from "fs";
import { join } from "path";

const DEFAULT_ROOT = new URL("..", import.meta.url).pathname;

interface M2cOptions {
  contextFile?: string;
  write?: boolean;
}

/**
 * Resolve the .s file for a function, handling named symbols whose
 * .s filename differs from the directory name.
 */
function resolveSFile(funcName: string, root: string): string {
  const asmDir = join("build/asm/nonmatchings", funcName);
  let sFile = join(asmDir, `${funcName}.s`);

  if (!existsSync(join(root, sFile))) {
    const absDir = join(root, asmDir);
    if (existsSync(absDir)) {
      const files = readdirSync(absDir).filter((f) => f.endsWith(".s"));
      if (files.length === 1) {
        sFile = join(asmDir, files[0]);
      }
    }
  }

  if (!existsSync(join(root, sFile))) {
    throw new Error(`Assembly file not found: ${sFile}`);
  }

  return sFile;
}

/**
 * Run m2c on a single function and return the wrapped C output.
 * Automatically detects jump table references and passes rodata files.
 */
export function runM2c(funcName: string, root: string = DEFAULT_ROOT, options: M2cOptions = {}): string {
  const sFile = resolveSFile(funcName, root);
  const sBasename = sFile.split("/").pop()!.replace(/\.s$/, "");

  const cmd = [
    "python3", "tools/m2c/m2c.py",
    "--target", "mipsel-gcc-c",
    "-f", sBasename,
  ];

  // Context headers
  const globalsCtx = join(root, "build/m2c_globals.ctx");
  if (existsSync(globalsCtx)) {
    cmd.push("--context", "build/m2c_globals.ctx");
  }
  const autoContext = join(root, "include/functions.h");
  if (options.contextFile) {
    cmd.push("--context", options.contextFile);
  } else if (existsSync(autoContext)) {
    cmd.push("--context", "include/functions.h");
  }

  cmd.push(sFile);

  // Auto-detect jump table references and find the data file(s) that define them
  const sContent = readFileSync(join(root, sFile), "utf-8");
  const jtblRefs = [...sContent.matchAll(/jtbl_[0-9A-Fa-f]+/g)].map((m) => m[0]);
  if (jtblRefs.length > 0) {
    const unique = [...new Set(jtblRefs)];
    const dataDir = join(root, "build/asm/data");
    if (existsSync(dataDir)) {
      const dataFiles = readdirSync(dataDir).filter((f) => f.endsWith(".s"));
      const needed = new Set<string>();
      for (const df of dataFiles) {
        const content = readFileSync(join(dataDir, df), "utf-8");
        for (const sym of unique) {
          if (content.includes(sym)) {
            needed.add(`build/asm/data/${df}`);
          }
        }
      }
      for (const f of needed) {
        cmd.push(f);
      }
    }
  }

  const m2cOutput = execSync(cmd.join(" "), { cwd: root, encoding: "utf-8" });

  const output = [
    '#include "common.h"',
    "",
    m2cOutput.trim(),
    "",
  ].join("\n");

  if (options.write) {
    const cFile = join("src", `${funcName}.c`);
    mkdirSync(join(root, "src"), { recursive: true });
    writeFileSync(join(root, cFile), output);
  }

  return output;
}

// --- CLI ---

const isCLI = process.argv[1]?.endsWith("m2cFunc.ts");
if (isCLI) {
  const args = process.argv.slice(2);
  const writeMode = args.includes("--write");
  const ctxIdx = args.indexOf("--context");
  const contextFile = ctxIdx >= 0 ? args[ctxIdx + 1] : undefined;
  const funcName = args.find((a) => !a.startsWith("--") && a !== contextFile);

  if (!funcName) {
    console.error("Usage: npx tsx tools/m2cFunc.ts <func_name> [--write] [--context <file>]");
    process.exit(1);
  }

  try {
    const output = runM2c(funcName, DEFAULT_ROOT, { contextFile, write: writeMode });
    if (writeMode) {
      console.log(`Wrote src/${funcName}.c`);
    } else {
      process.stdout.write(output);
    }
  } catch (e: any) {
    console.error("m2c failed:", e.message);
    process.exit(1);
  }
}
