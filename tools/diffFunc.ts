/**
 * diffFunc.ts — Compile a .c file and diff against the original .o
 *
 * Usage: npx tsx tools/diffFunc.ts func_8001FE00
 *        npx tsx tools/diffFunc.ts func_8001FE00 --watch
 *        npx tsx tools/diffFunc.ts src/func_8001FE00.c build/src/func_8001FE00.c.o
 */

import { execSync } from "child_process";
import { watchFile, existsSync } from "fs";

const ROOT = new URL("..", import.meta.url).pathname;

// Toolchain (from Makefile)
const GCC_VERSION = "2.8.0";
const CC = `tools/old-gcc/build-gcc-${GCC_VERSION}-psx/cc1`;
const MASPSX = "python3 tools/maspsx/maspsx.py";
const CROSS = "mips-linux-gnu-";
const AS = `${CROSS}as`;
const CPP = `${CROSS}cpp`;
const OBJDUMP = `${CROSS}objdump`;

const CPPFLAGS = "-Iinclude -undef -D__GNUC__=2 -lang-c";
const CC1FLAGS = "-mips1 -mcpu=r3000 -quiet -G8 -O2";
const ASFLAGS = "-march=r3000 -mtune=r3000 -EL -no-pad-sections -Iinclude";

function run(cmd: string): string {
  return execSync(cmd, { cwd: ROOT, encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] });
}

function compile(src: string): string {
  const stem = src.replace(/^src\//, "").replace(/\.c$/, "");
  const dir = "build/src";
  const i = `${dir}/${stem}.i`;
  const s = `${dir}/${stem}.s`;
  const o = `${dir}/${stem}.c.o`;
  run(`mkdir -p ${dir}`);
  run(`${CPP} ${CPPFLAGS} ${src} -o ${i}`);
  run(`${CC} ${CC1FLAGS} ${i} -o ${s}`);
  run(`${MASPSX} --expand-div --run-assembler --gnu-as-path ${AS} -o ${o} ${ASFLAGS} ${s}`);
  return o;
}

function objdump(obj: string): string {
  return run(`${OBJDUMP} -d --no-show-raw-insn ${obj}`);
}

/** Extract instruction lines from objdump output */
function instrLines(dump: string): string[] {
  return dump.split("\n").filter((l) => /^\s+[0-9a-f]+:\s/.test(l));
}

function doDiff(src: string, target: string): void {
  console.clear();
  console.log(`target:  ${target}`);
  console.log(`source:  ${src}\n`);
  try {
    const compiled = compile(src);
    const left = objdump(target);
    const right = objdump(compiled);

    // Write to temp files for diff
    const { writeFileSync } = require("fs");
    const ltmp = "/tmp/diffFunc-target.txt";
    const rtmp = "/tmp/diffFunc-compiled.txt";
    writeFileSync(ltmp, left);
    writeFileSync(rtmp, right);

    try {
      const out = execSync(`diff --color=always -y -W 120 ${ltmp} ${rtmp}`, {
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "pipe"],
      });
      process.stdout.write(out);
    } catch (e: any) {
      // diff exits 1 when files differ
      if (e.stdout) process.stdout.write(e.stdout);
    }

    // Match percentage based on instruction lines
    const targetInstrs = instrLines(left);
    const compiledInstrs = instrLines(right);
    const total = targetInstrs.length;
    let matches = 0;
    for (let i = 0; i < total; i++) {
      if (targetInstrs[i]?.trim() === compiledInstrs[i]?.trim()) matches++;
    }
    const pct = total > 0 ? ((matches / total) * 100).toFixed(1) : "0.0";
    console.log(`\nMatch: ${matches}/${total} (${pct}%)`);
  } catch (e: any) {
    console.error("Compile error:", e.stderr || e.message);
  }
}

function resolveArgs(args: string[]): { src: string; target: string } {
  if (args.length === 2) {
    return { src: args[0], target: args[1] };
  }
  if (args.length === 1) {
    const name = args[0].replace(/^src\//, "").replace(/\.c$/, "");
    return { src: `src/${name}.c`, target: `build/src/${name}.c.o` };
  }
  console.error("Usage: npx tsx tools/diffFunc.ts <func_name>");
  console.error("       npx tsx tools/diffFunc.ts <src.c> <target.o>");
  process.exit(1);
}

// --- Main ---
const rawArgs = process.argv.slice(2);
const watchMode = rawArgs.includes("--watch");
const filteredArgs = rawArgs.filter((a) => a !== "--watch");

const { src, target } = resolveArgs(filteredArgs);
if (!existsSync(src)) { console.error(`Not found: ${src}`); process.exit(1); }
if (!existsSync(target)) { console.error(`Not found: ${target}`); process.exit(1); }

doDiff(src, target);

if (watchMode) {
  watchFile(src, { interval: 500 }, () => {
    doDiff(src, target);
  });
}
