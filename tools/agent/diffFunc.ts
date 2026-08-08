/**
 * diffFunc.ts — the per-function oracle: are these the right bytes?
 *
 * Usage: npx tsx tools/agent/diffFunc.ts func_8001FE00
 *        npx tsx tools/agent/diffFunc.ts func_8001FE00 --watch
 *        npx tsx tools/agent/diffFunc.ts func_8001FE00 --columns  (side-by-side)
 *        npx tsx tools/agent/diffFunc.ts func_8001FE00 --src notes/scratch/cand.c
 *        npx tsx tools/agent/diffFunc.ts func_8001FE00 --bytes    (linked binary)
 *
 * The source is compiled, its `.text` is relocated to the function's original
 * addresses, and the result is compared with the original image's own bytes.
 * The diff and the verdict come out of that one comparison, so a MATCH means
 * byte-identical code including every relocation value — a transposed pair of
 * same-shaped globals shows up in the diff itself. There is no provisional
 * stage and nothing to escalate; see tools/lib/functionOracle.ts.
 *
 * What it does not check: that the function lands at the right address in the
 * real link, or that anything else in the binary is right. `make check` is the
 * authority for those, and `--bytes` is the same check narrowed to one
 * function (it needs a clean full build, so it is opt-in).
 */

import { execSync } from "child_process";
import { watchFile, existsSync, writeFileSync, readFileSync } from "fs";
import { join } from "path";
import {
  configuredAsFlags,
  configuredCc1Flags,
  configuredCppFlags,
  configuredGccVersion,
  configuredMaspsxFlags,
} from "./decompToolchain.js";
import {
  type OracleResult,
  type RenderedWord,
  compareFunction,
  renderDiff,
  renderVerdict,
} from "../lib/functionOracle.js";
import { loadPsxExeInfo, vramToRom } from "../lib/psxExeInfo.js";
import { loadFunctionSpans } from "../lib/symbolIndex.js";

const ROOT = new URL("../..", import.meta.url).pathname;

// Toolchain (from Makefile)
/* Version is project configuration (Makefile GCC_VERSION), not a constant. */
const GCC_VERSION = configuredGccVersion();
const CC = `tools/vendor/old-gcc/build-gcc-${GCC_VERSION}-psx/cc1`;
const MASPSX = "python3 tools/vendor/maspsx/maspsx.py";
const CROSS = "mips-linux-gnu-";
const AS = `${CROSS}as`;
const CPP = `${CROSS}cpp`;

const CPPFLAGS = configuredCppFlags().join(" ");
const CC1FLAGS = configuredCc1Flags().join(" ");
const ASFLAGS = configuredAsFlags().join(" ");
const MASPSXFLAGS = configuredMaspsxFlags().join(" ");

/** Parse configs/flag_overrides.mk for CC1FLAGS_<stem> := <flags> lines */
function loadFlagOverrides(): Map<string, string> {
  const overrides = new Map<string, string>();
  const overridePath = join(ROOT, "configs/flag_overrides.mk");
  if (!existsSync(overridePath)) return overrides;
  const content = readFileSync(overridePath, "utf-8");
  for (const line of content.split("\n")) {
    const m = line.match(/^CC1FLAGS_(\S+)\s*:=\s*(.+)$/);
    if (m) overrides.set(m[1], m[2].trim());
  }
  return overrides;
}

const flagOverrides = loadFlagOverrides();

function run(cmd: string): string {
  return execSync(cmd, { cwd: ROOT, encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] });
}

/**
 * GCC 2.95 exits 33 whenever it emitted any diagnostic, and it writes a `.s`
 * even for units it reported errors in. So the status cannot tell a warning
 * from an error, and the presence of output does not mean the unit compiled.
 *
 * Trusting the status let a translation unit through whose `libcd.h`
 * declaration had been mangled by the `fp` register macro from `asm.h`
 * (`CdlFILE *CdSearchFile(CdlFILE *$30, ...)`), and diffFunc reported a 70.4%
 * masked score for a program that does not build. Classify from the
 * diagnostic text instead.
 */
function hasCompileError(output: string): boolean {
  for (const raw of output.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    /* Context lines locate the next diagnostic; they are not diagnostics. */
    if (line.startsWith("In file included from")) continue;
    if (/^from .+:\d+[:,]?$/.test(line)) continue;
    if (/: In (function|constructor|destructor|member function)\b/.test(line)) continue;
    if (/\bwarning:\b/.test(line)) continue;
    /* `file:line: message` with no `warning:` is an error. */
    if (/^.+:\d+:\s+\S/.test(line)) return true;
    if (/^cc1: /.test(line)) return true;
  }
  return false;
}

function runStep(label: string, cmd: string): string {
  try {
    return execSync(cmd, { cwd: ROOT, encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] });
  } catch (e: any) {
    const output = `${e.stderr ?? ""}\n${e.stdout ?? ""}`;
    if (label === "cc1" && e.status === 33 && !hasCompileError(output)) {
      return output;
    }
    const msg = (e.stderr || e.stdout || e.message || "").trim();
    throw new Error(`${label}: ${msg}`);
  }
}

/**
 * Compile one source through the configured toolchain.
 *
 * Artifacts are named after the *function*, not the source file, so a
 * candidate compiled from elsewhere still lands where the rest of the
 * diagnostics look for it (`build/diffFunc/<func>.s`), and picks up the same
 * per-file flag override the build would apply to that function.
 */
function compile(src: string, stem: string): string {
  const dir = "build/diffFunc";
  const i = `${dir}/${stem}.i`;
  const s = `${dir}/${stem}.s`;
  const o = `${dir}/${stem}.c.o`;
  run(`mkdir -p ${dir}`);
  const extraFlags = flagOverrides.get(stem) || "";
  const cc1flags = extraFlags ? `${CC1FLAGS} ${extraFlags}` : CC1FLAGS;
  runStep("cpp", `${CPP} ${CPPFLAGS} ${src} -o ${i}`);
  runStep("cc1", `${CC} ${cc1flags} ${i} -o ${s}`);
  runStep("maspsx", `${MASPSX} ${MASPSXFLAGS} --gnu-as-path ${AS} -o ${o} ${ASFLAGS} ${s}`);
  return join(ROOT, o);
}

/** Mnemonic-level multiset difference — names the missing/extra instructions
 *  behind an instruction-count delta instead of leaving a wall of ± lines. */
function mnemonicDelta(target: RenderedWord[], compiled: RenderedWord[]): string | null {
  const mnemonic = (word: RenderedWord) => word.text.split(/\s+/)[0].toLowerCase();
  const counts = new Map<string, number>();
  for (const word of target) counts.set(mnemonic(word), (counts.get(mnemonic(word)) || 0) + 1);
  for (const word of compiled) counts.set(mnemonic(word), (counts.get(mnemonic(word)) || 0) - 1);
  const targetOnly: string[] = [];
  const compiledOnly: string[] = [];
  for (const [name, count] of [...counts.entries()].sort()) {
    if (count > 0) targetOnly.push(count > 1 ? `${count}× ${name}` : name);
    else if (count < 0) compiledOnly.push(count < -1 ? `${-count}× ${name}` : name);
  }
  if (targetOnly.length === 0 && compiledOnly.length === 0) return null;
  const parts: string[] = [];
  if (targetOnly.length > 0) parts.push(`target has ${targetOnly.join(", ")} the compiled side lacks`);
  if (compiledOnly.length > 0) parts.push(`compiled has extra ${compiledOnly.join(", ")}`);
  return parts.join("; ");
}

/** Side-by-side view via GNU diff over the two symbolised instruction streams. */
function renderColumns(result: OracleResult): void {
  const ltmp = "/tmp/diffFunc-target.txt";
  const rtmp = "/tmp/diffFunc-compiled.txt";
  writeFileSync(ltmp, result.targetWords.map((word) => word.text).join("\n") + "\n");
  writeFileSync(rtmp, result.candidateWords.map((word) => word.text).join("\n") + "\n");
  try {
    process.stdout.write(execSync(`diff --color=always -y -W 120 ${ltmp} ${rtmp}`, {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    }));
  } catch (e: any) {
    if (e.stdout) process.stdout.write(e.stdout);
  }
}

function doDiff(funcName: string, src: string): void {
  console.log(`target:  original bytes of ${funcName}`);
  console.log(`source:  ${src}\n`);
  let result: OracleResult;
  try {
    const object = compile(src, funcName);
    result = compareFunction(funcName, { objectPath: object });
  } catch (e: any) {
    console.error("Compile error:", e.stderr || e.message);
    return;
  }

  if (columnsMode) renderColumns(result);
  else for (const line of renderDiff(result)) console.log(line);

  console.log("");
  for (const line of renderVerdict(result)) console.log(line);

  if (result.targetWords.length !== result.candidateWords.length) {
    const delta = mnemonicDelta(result.targetWords, result.candidateWords);
    if (delta) console.log(`  count delta: ${delta}`);
  }

  /* Both artifacts on disk, for tools that want to read the streams. */
  writeFileSync("/tmp/diffFunc-target.txt", result.targetWords.map((word) => word.text).join("\n") + "\n");
  writeFileSync("/tmp/diffFunc-compiled.txt", result.candidateWords.map((word) => word.text).join("\n") + "\n");
}

/**
 * The same function's bytes in the *linked* binary.
 *
 * This is `make check` narrowed to one function: it additionally proves the
 * function was placed where the original put it. It needs the whole build to
 * link, so it is opt-in rather than something the oracle depends on.
 */
function verifyLinkedBytes(funcName: string): boolean {
  const span = loadFunctionSpans().find((entry) => entry.name === funcName);
  if (!span) {
    console.log(`BYTE VERIFY SKIPPED: ${funcName} has no subsegment in configs/splat.yaml`);
    return false;
  }
  try {
    run("make -j1 build/slus_011.bin");
  } catch (e: any) {
    console.log("BYTE VERIFY UNAVAILABLE: the full build does not link. The per-function");
    console.log("  verdict above does not depend on this; fix the build to check placement:");
    console.log((e.stderr || e.message || "").trim().split("\n").slice(-4).join("\n"));
    return false;
  }
  const info = loadPsxExeInfo();
  const offset = vramToRom(span.vram, info);
  const orig = readFileSync(info.binaryPath).subarray(offset, offset + span.size);
  const built = readFileSync(join(ROOT, "build/slus_011.bin")).subarray(offset, offset + span.size);
  if (orig.equals(built)) {
    console.log("VERIFIED: byte-identical in the linked binary, at the original address.");
    return true;
  }
  console.log("LINKED BYTES DIFFER — the function does not match in place.");
  for (let w = 0; w + 4 <= span.size; w += 4) {
    const ow = orig.readUInt32LE(w);
    const bw = built.readUInt32LE(w);
    if (ow === bw) continue;
    const vram = span.vram + w;
    console.log(`  0x${vram.toString(16).toUpperCase()}: original ${ow.toString(16).padStart(8, "0")}  built ${bw.toString(16).padStart(8, "0")}`);
  }
  return false;
}

// --- Main ---
const rawArgs = process.argv.slice(2);
const watchMode = rawArgs.includes("--watch");
const columnsMode = rawArgs.includes("--columns");
const bytesMode = rawArgs.includes("--bytes");
const srcIndex = rawArgs.indexOf("--src");
const srcOverride = srcIndex >= 0 ? rawArgs[srcIndex + 1] : undefined;
const positional = rawArgs.filter((arg, index) =>
  !arg.startsWith("--") && !(srcIndex >= 0 && index === srcIndex + 1));

if (positional.length !== 1) {
  console.error("Usage: npx tsx tools/agent/diffFunc.ts <func_name> [--src <file.c>] [--watch|--columns|--bytes]");
  process.exit(1);
}

const funcName = positional[0].replace(/^src\//, "").replace(/\.c$/, "");
const src = srcOverride ?? `src/${funcName}.c`;
if (!existsSync(join(ROOT, src)) && !existsSync(src)) {
  console.error(`Not found: ${src}`);
  process.exit(1);
}

if (bytesMode) {
  compile(src, funcName);
  verifyLinkedBytes(funcName);
} else {
  doDiff(funcName, src);
}

if (watchMode) {
  watchFile(src, { interval: 500 }, () => {
    doDiff(funcName, src);
  });
}
