/**
 * diffFunc.ts — Compile a .c file and diff against the original .o
 *
 * Usage: npx tsx tools/agent/diffFunc.ts func_8001FE00
 *        npx tsx tools/agent/diffFunc.ts func_8001FE00 --watch
 *        npx tsx tools/agent/diffFunc.ts func_8001FE00 --columns   (side-by-side diff)
 *        npx tsx tools/agent/diffFunc.ts src/func_8001FE00.c build/src/func_8001FE00.c.o
 */

import { execSync } from "child_process";
import { watchFile, existsSync, writeFileSync, readFileSync, readdirSync, mkdirSync } from "fs";
import { join } from "path";

const ROOT = new URL("../..", import.meta.url).pathname;

// Toolchain (from Makefile)
const GCC_VERSION = "2.95.2";
const CC = `tools/vendor/old-gcc/build-gcc-${GCC_VERSION}-psx/cc1`;
const MASPSX = "python3 tools/vendor/maspsx/maspsx.py";
const CROSS = "mips-linux-gnu-";
const AS = `${CROSS}as`;
const CPP = `${CROSS}cpp`;
const OBJDUMP = `${CROSS}objdump`;

const CPPFLAGS = "-Iinclude -Iinclude/psyq -undef -D__GNUC__=2 -DINCLUDE_ASM_USE_MACRO_INC=1 -lang-c";
const CC1FLAGS = "-O2 -G8 -mips1 -mcpu=r3000 -funsigned-char -fpeephole -ffunction-cse -fpcc-struct-return -fcommon -fverbose-asm -msoft-float -mgas -fgnu-linker -quiet";
const ASFLAGS = "-march=r3000 -mtune=r3000 -EL -G8 -no-pad-sections -Iinclude -Iinclude/psyq";

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

function runStep(label: string, cmd: string): string {
  try {
    return execSync(cmd, { cwd: ROOT, encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] });
  } catch (e: any) {
    const msg = (e.stderr || e.stdout || e.message || "").trim();
    throw new Error(`${label}: ${msg}`);
  }
}

function compile(src: string): string {
  const stem = src.replace(/^src\//, "").replace(/\.c$/, "");
  const dir = "build/diffFunc";
  const i = `${dir}/${stem}.i`;
  const s = `${dir}/${stem}.s`;
  const o = `${dir}/${stem}.c.o`;
  run(`mkdir -p ${dir}`);
  const extraFlags = flagOverrides.get(stem) || "";
  const cc1flags = extraFlags ? `${CC1FLAGS} ${extraFlags}` : CC1FLAGS;
  runStep("cpp", `${CPP} ${CPPFLAGS} ${src} -o ${i}`);
  runStep("cc1", `${CC} ${cc1flags} ${i} -o ${s}`);
  runStep("maspsx", `${MASPSX} --aspsx-version 2.77 --dont-force-G0 --run-assembler --gnu-as-path ${AS} -o ${o} ${ASFLAGS} ${s}`);
  return o;
}

function objdump(obj: string): string {
  return run(`${OBJDUMP} -d --no-show-raw-insn ${obj}`);
}

/**
 * Extract comparable instruction lines from objdump output.
 *
 * Objdump renders resolved local branch targets using whichever symbols happen
 * to exist in the object, e.g. `_8001D284` in an assembled target versus
 * `FunctionName+0x68` in compiler output. The numeric target already captures
 * the encoded branch offset, so discard only that cosmetic annotation for
 * PC-relative branches. Keep annotations on jumps and calls, where the symbol
 * can identify a meaningful relocation target.
 */
function instrLines(dump: string): string[] {
  const localBranchMnemonics = new Set([
    "b", "beq", "beql", "beqz", "beqzl", "bgez", "bgezl", "bgtz", "bgtzl",
    "blez", "blezl", "bltz", "bltzl", "bne", "bnel", "bnez", "bnezl",
  ]);

  return dump.split("\n")
    .filter((line) => /^\s+[0-9a-f]+:\s/.test(line))
    .map((line) => {
      const trimmed = line.trim();
      const mnemonic = trimmed.match(/^[0-9a-f]+:\s+([^\s]+)/)?.[1].toLowerCase();
      return mnemonic && localBranchMnemonics.has(mnemonic)
        ? trimmed.replace(/\s+<[^>]+>$/, "")
        : trimmed;
    });
}

function doDiff(src: string, target: string | null, funcName?: string): void {
  if (!target && funcName) {
    /* No asm available — compare linked binaries */
    console.log(`target:  original binary (linked comparison)`);
    console.log(`source:  ${src}\n`);
    doDiffFromBinary(src, funcName);
    return;
  }

  console.log(`target:  ${target}`);
  console.log(`source:  ${src}\n`);
  try {
    const compiled = compile(src);
    const left = objdump(target!);
    const right = objdump(compiled);
    const targetInstrs = instrLines(left);
    const compiledInstrs = instrLines(right);

    const ltmp = "/tmp/diffFunc-target.txt";
    const rtmp = "/tmp/diffFunc-compiled.txt";
    writeFileSync(ltmp, targetInstrs.join("\n") + "\n");
    writeFileSync(rtmp, compiledInstrs.join("\n") + "\n");

    const diffFlags = columnsMode ? "-y -W 120" : "-u";
    try {
      const out = execSync(`diff --color=always ${diffFlags} ${ltmp} ${rtmp}`, {
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "pipe"],
      });
      process.stdout.write(out);
    } catch (e: any) {
      if (e.stdout) process.stdout.write(e.stdout);
    }

    const total = Math.max(targetInstrs.length, compiledInstrs.length);
    let matches = 0;
    for (let i = 0; i < total; i++) {
      if (targetInstrs[i]?.trim() === compiledInstrs[i]?.trim()) matches++;
    }
    const pct = total > 0 ? ((matches / total) * 100).toFixed(1) : "0.0";
    console.log(`\nMatch: ${matches}/${total} instructions (${pct}%)`);
    if (targetInstrs.length !== compiledInstrs.length) {
      console.log(`  target: ${targetInstrs.length} instrs, compiled: ${compiledInstrs.length} instrs`);
    }
  } catch (e: any) {
    console.error("Compile error:", e.stderr || e.message);
  }
}

/** Assemble a nonmatchings .s file into a .o for diffing.
 *  The nonmatchings .s files use macros (glabel, jlabel, endlabel, etc.)
 *  defined in include/macro.inc, so we create a wrapper that includes the
 *  macro definitions before the actual function assembly. */
function resolveAsmSource(name: string): string {
  /* Try nonmatchings first (active splat output) */
  const primary = `build/asm/nonmatchings/${name}/${name}.s`;
  if (existsSync(primary)) return primary;

  /* Handle named symbols where .s filename differs from directory name */
  const dir = `build/asm/nonmatchings/${name}`;
  if (existsSync(dir)) {
    const files = readdirSync(dir).filter((f: string) => f.endsWith(".s"));
    if (files.length === 1) return `${dir}/${files[0]}`;
  }

  return "";
}

/** Look up function address and size from splat.yaml */
function getFuncInfo(name: string): { vram: number; size: number } | null {
  const yamlPath = join(ROOT, "configs/splat.yaml");
  if (!existsSync(yamlPath)) return null;

  const yaml = readFileSync(yamlPath, "utf-8");
  const lines = yaml.split("\n");
  const segRe = /^\s*-\s*\[(0x[0-9A-Fa-f]+),\s*(?:asm|c)(?:,\s*\S+)?\]\s*#\s*(0x[0-9A-Fa-f]+)\s+(\S+)/;
  const nextRe = /^\s*-\s*\[(0x[0-9A-Fa-f]+)/;

  const offsets: number[] = [];
  let funcOffset = -1;
  let funcVram = 0;

  for (const line of lines) {
    const m = line.match(nextRe);
    if (m) offsets.push(parseInt(m[1], 16));

    const seg = line.match(segRe);
    if (seg && seg[3] === name) {
      funcOffset = parseInt(seg[1], 16);
      funcVram = parseInt(seg[2], 16);
    }
  }

  if (funcOffset < 0) return null;

  offsets.sort((a, b) => a - b);
  const idx = offsets.indexOf(funcOffset);
  const nextOffset = idx >= 0 && idx + 1 < offsets.length ? offsets[idx + 1] : funcOffset;
  const size = nextOffset - funcOffset;

  return { vram: funcVram, size };
}

/** Disassemble a function's range from a flat binary file */
function disassembleRange(binFile: string, offset: number, size: number): string[] {
  const dir = "build/diffFunc";
  mkdirSync(join(ROOT, dir), { recursive: true });

  const binary = readFileSync(join(ROOT, binFile));
  const funcBytes = binary.subarray(offset, offset + size);

  const tmpBin = join(ROOT, `${dir}/_range.bin`);
  const tmpO = `${dir}/_range.o`;
  writeFileSync(tmpBin, funcBytes);
  run(`${CROSS}objcopy -I binary -O elf32-tradlittlemips -B mips ` +
      `--rename-section .data=.text,contents,alloc,load,code ` +
      `${tmpBin} ${tmpO}`);

  const dump = run(`${OBJDUMP} -d -z --no-show-raw-insn ${tmpO}`);
  const lines: string[] = [];
  for (const line of dump.split("\n")) {
    const m = line.match(/^\s*[0-9a-f]+:\s+(.+)/);
    if (m) lines.push(m[1].trim());
  }
  return lines;
}

/** Compare a function using linked binaries: original EXE vs build output.
 *  Compiles the C file, builds the full project, then extracts and compares
 *  the same address range from both binaries. */
function doDiffFromBinary(src: string, funcName: string): void {
  const info = getFuncInfo(funcName);
  if (!info) {
    console.error(`Function ${funcName} not found in configs/splat.yaml`);
    process.exit(1);
  }

  try {
    /* Compile the C file (so build/ has the updated .o) */
    compile(src);

    /* Build the full binary */
    run("make -j1 build/slus_011.bin");

    const payloadOffset = 0x800;
    const loadAddr = 0x80010000;
    const funcFileOffset = payloadOffset + (info.vram - loadAddr);

    /* Disassemble from original */
    const origInstrs = disassembleRange(
      "extracted/iso/slus_011.15", funcFileOffset, info.size
    );

    /* Disassemble from built */
    const builtInstrs = disassembleRange(
      "build/slus_011.bin", funcFileOffset, info.size
    );

    /* Diff */
    const ltmp = "/tmp/diffFunc-target.txt";
    const rtmp = "/tmp/diffFunc-compiled.txt";
    writeFileSync(ltmp, origInstrs.join("\n"));
    writeFileSync(rtmp, builtInstrs.join("\n"));

    const diffFlags = columnsMode ? "-y -W 120" : "-u";
    try {
      const out = execSync(`diff --color=always ${diffFlags} ${ltmp} ${rtmp}`, {
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "pipe"],
      });
      process.stdout.write(out);
    } catch (e: any) {
      if (e.stdout) process.stdout.write(e.stdout);
    }

    const total = Math.max(origInstrs.length, builtInstrs.length);
    let matches = 0;
    for (let i = 0; i < total; i++) {
      if (origInstrs[i] === builtInstrs[i]) matches++;
    }
    const pct = total > 0 ? ((matches / total) * 100).toFixed(1) : "0.0";
    console.log(`\nMatch: ${matches}/${total} instructions (${pct}%)`);
  } catch (e: any) {
    console.error("Compile error:", e.stderr || e.message);
  }
}

function assembleTarget(name: string): string | null {
  const asmSrc = resolveAsmSource(name);
  if (!asmSrc) return null; /* will use binary extraction path */

  const dir = "build/diffFunc";
  const wrapper = `${dir}/${name}.target.s`;
  const o = `${dir}/${name}.target.o`;
  run(`mkdir -p ${dir}`);
  writeFileSync(
    `${ROOT}/${wrapper}`,
    `.include "include/macro.inc"\n` +
    `.set noat\n` +
    `.set noreorder\n` +
    `.include "${asmSrc}"\n`
  );
  run(`${AS} ${ASFLAGS} ${wrapper} -o ${o}`);
  return o;
}

function resolveArgs(args: string[]): { src: string; target: string | null; funcName?: string } {
  if (args.length === 2) {
    return { src: args[0], target: args[1] };
  }
  if (args.length === 1) {
    const name = args[0].replace(/^src\//, "").replace(/\.c$/, "");
    const targetO = assembleTarget(name);
    return { src: `src/${name}.c`, target: targetO, funcName: name };
  }
  console.error("Usage: npx tsx tools/agent/diffFunc.ts <func_name>");
  console.error("       npx tsx tools/agent/diffFunc.ts <src.c> <target.o>");
  process.exit(1);
}

// --- Main ---
const rawArgs = process.argv.slice(2);
const watchMode = rawArgs.includes("--watch");
const columnsMode = rawArgs.includes("--columns");
const filteredArgs = rawArgs.filter((a) => a !== "--watch" && a !== "--columns");

const { src, target, funcName } = resolveArgs(filteredArgs);
if (!existsSync(src)) { console.error(`Not found: ${src}`); process.exit(1); }
if (target && !existsSync(target)) { console.error(`Not found: ${target}`); process.exit(1); }

doDiff(src, target, funcName);

if (watchMode) {
  watchFile(src, { interval: 500 }, () => {
    doDiff(src, target, funcName);
  });
}
