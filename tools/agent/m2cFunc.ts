/**
 * m2cFunc.ts — Run m2c on a single function's .s file
 *
 * The function's container is derived from its name, so the same invocation
 * works whichever binary the function lives in: the assembly, the destination
 * source file, the context headers and the jump-table data all resolve through
 * that container rather than through the PS-X EXE's layout.
 *
 * Usage:
 *   npx tsx tools/agent/m2cFunc.ts func_80011F08              # print C to stdout
 *   npx tsx tools/agent/m2cFunc.ts func_80011F08 --write      # write to its source file
 *   npx tsx tools/agent/m2cFunc.ts ovl_11_func_800BD160 --write
 *   npx tsx tools/agent/m2cFunc.ts func_80011F08 --context include/functions.h
 *
 * Importable:
 *   import { runM2c } from "./m2cFunc.js";
 *   const output = runM2c("func_80011F08", projectRoot);
 */

import { execSync } from "child_process";
import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync } from "fs";
import { dirname, join, relative } from "path";
import { EXE_CONTAINER_ID, containerOfSymbol, loadContainers, type Container } from "../lib/container.js";

const DEFAULT_ROOT = new URL("../..", import.meta.url).pathname;

interface M2cOptions {
  contextFile?: string;
  write?: boolean;
}

/**
 * The container that defines this symbol, or null when the container model
 * cannot be read at all. Overlay symbols carry their container id as a prefix;
 * a bare name is the executable's.
 */
function containerFor(funcName: string): Container | null {
  try {
    const containers = loadContainers();
    return (
      containerOfSymbol(funcName, containers) ??
      containers.find((container) => container.id === EXE_CONTAINER_ID) ??
      null
    );
  } catch {
    return null;
  }
}

/**
 * Resolve the .s file for a function, handling named symbols whose
 * .s filename differs from the directory name.
 */
function resolveSFile(funcName: string, root: string, container: Container | null): string {
  const asmDir = join(container?.paths.asmDir ?? "build/asm", "nonmatchings", funcName);
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
  const container = containerFor(funcName);
  const sFile = resolveSFile(funcName, root, container);
  const sBasename = sFile.split("/").pop()!.replace(/\.s$/, "");

  const cmd = [
    "python3", "tools/vendor/m2c/m2c.py",
    "--target", "mipsel-gcc-c",
    "-f", sBasename,
  ];

  // Context headers
  const globalsCtx = join(root, "build/m2c_globals.ctx");
  if (existsSync(globalsCtx)) {
    cmd.push("--context", "build/m2c_globals.ctx");
  }
  /* Order is load-bearing. m2c parses --context files in sequence into a
   * single scope, so sdk_types.h must precede the signatures in functions.h
   * that name those types; reversed, the whole context fails to parse and m2c
   * refuses every function. This pair is not caller-overridable for that
   * reason — an explicit --context is added to it, never substituted.
   *
   * An overlay's own header comes last, after the engine's: it calls into the
   * engine, so the engine's signatures have to already be in scope. */
  const contexts = ["include/sdk_types.h", "include/functions.h"];
  if (container && container.kind !== "exe") contexts.push(`include/overlays/${container.id}.h`);
  for (const ctx of contexts) {
    if (existsSync(join(root, ctx))) cmd.push("--context", ctx);
  }
  if (options.contextFile) {
    cmd.push("--context", options.contextFile);
  }

  cmd.push(sFile);

  // Auto-detect jump table references and find the data file(s) that define them
  const sContent = readFileSync(join(root, sFile), "utf-8");
  const jtblRefs = [...sContent.matchAll(/jtbl_[0-9A-Fa-f]+/g)].map((m) => m[0]);
  if (jtblRefs.length > 0) {
    const unique = [...new Set(jtblRefs)];
    const dataDir = join(root, container?.paths.asmDir ?? "build/asm", "data");
    if (existsSync(dataDir)) {
      const dataFiles = readdirSync(dataDir).filter((f) => f.endsWith(".s"));
      const needed = new Set<string>();
      for (const df of dataFiles) {
        const content = readFileSync(join(dataDir, df), "utf-8");
        for (const sym of unique) {
          if (content.includes(sym)) {
            needed.add(relative(root, join(dataDir, df)));
          }
        }
      }
      for (const f of needed) {
        cmd.push(f);
      }
    }
  }

  /* m2c splits its failure reporting across streams: a C context syntax error
   * arrives on stdout, wrapped in a "Decompilation failure" comment block,
   * while an unknown function name arrives on stderr. Both exit nonzero.
   * Reporting only the exception message discards whichever stream carried the
   * reason, which makes a project-wide context break read as a local one. */
  let m2cOutput: string;
  try {
    m2cOutput = execSync(cmd.join(" "), {
      cwd: root,
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (e: any) {
    const detail = [e.stdout, e.stderr].map((s: string) => (s ?? "").trim()).filter(Boolean).join("\n");
    throw new Error(`${cmd.join(" ")}\n\n${detail || e.message}`);
  }

  /* A context failure can also arrive on a zero exit. Catching it here keeps
   * --write from committing a comment block into src/*.c as if it were code. */
  if (m2cOutput.includes("Decompilation failure:")) {
    throw new Error(`${cmd.join(" ")}\n\n${m2cOutput.trim()}`);
  }

  const output = [
    '#include "common.h"',
    "",
    m2cOutput.trim(),
    "",
  ].join("\n");

  if (options.write) {
    const cFile = join(container?.paths.srcDir ?? "src", `${funcName}.c`);
    mkdirSync(dirname(join(root, cFile)), { recursive: true });
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
    console.error("Usage: npx tsx tools/agent/m2cFunc.ts <func_name> [--write] [--context <file>]");
    process.exit(1);
  }

  try {
    const output = runM2c(funcName, DEFAULT_ROOT, { contextFile, write: writeMode });
    if (writeMode) {
      const container = containerFor(funcName);
      console.log(`Wrote ${join(container?.paths.srcDir ?? "src", `${funcName}.c`)}`);
    } else {
      process.stdout.write(output);
    }
  } catch (e: any) {
    console.error(`m2c failed:\n${e.message}`);
    process.exit(1);
  }
}
