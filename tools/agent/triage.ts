#!/usr/bin/env npx tsx
/**
 * triage.ts — pre-flight symptom detector for one function.
 *
 * Run this BEFORE authoring or perturbing source. It answers the question an
 * agent cannot ask when it does not yet know it is wrong: "does the target,
 * or my current source, carry a fingerprint this project has already
 * diagnosed and written down?"
 *
 * Each finding cites the note that covers it, so the knowledge is pulled in
 * by symptom rather than by title. Companion to flagProbe.ts (per-file flag
 * hypotheses) and scanReadBeforeDef.ts (register-variable fingerprints);
 * this one covers signature, ABI, and source-policy symptoms.
 *
 * Born from func_80016B7C, where ~20 variants were spent on a phantom inline
 * asm block because the frame-size signal for a missing parameter was never
 * read (notes/retros/func_80016B7C.md).
 *
 * Detectors:
 *   arity-frame     compiled frame/arg-area vs target — missing parameters
 *   arity-stack     loads from the incoming stack-argument region
 *   capture-ra      the CAPTURE_RA debug-hook signature in the target
 *   asm-policy      embedded asm without a sourcePolicy allowlist entry
 *   asm-dead        an embedded asm block whose output is clobbered unused
 *
 * Usage:
 *   npx tsx tools/agent/triage.ts func_80016B7C
 *   npx tsx tools/agent/triage.ts func_80016B7C --json
 *   npx tsx tools/agent/triage.ts func_80016B7C --src /tmp/experiment.c
 */

import { execSync } from "child_process";
import { existsSync, readFileSync, mkdirSync } from "fs";
import { join } from "path";

const ROOT = new URL("../..", import.meta.url).pathname;

/* Toolchain — kept in sync with diffFunc.ts. Only cpp+cc1 are needed here;
 * the .frame directive in cc1 output carries the whole frame decomposition,
 * so there is no reason to pay for maspsx and the assembler. */
const GCC_VERSION = "2.95.2";
const CC = `tools/vendor/old-gcc/build-gcc-${GCC_VERSION}-psx/cc1`;
const CPP = "mips-linux-gnu-cpp";
const CPPFLAGS =
  "-Iinclude -Iinclude/psyq -undef -D__GNUC__=2 -DINCLUDE_ASM_USE_MACRO_INC=1 -lang-c";
const CC1FLAGS =
  "-O2 -G8 -mips1 -mcpu=r3000 -funsigned-char -fpeephole -ffunction-cse " +
  "-fpcc-struct-return -fcommon -fverbose-asm -msoft-float -mgas -fgnu-linker -quiet";

/* Both spellings: target assembly uses names, cc1 output uses numbers. */
const CALL_CLOBBERED = new Set([
  "v0", "v1", "a0", "a1", "a2", "a3",
  "t0", "t1", "t2", "t3", "t4", "t5", "t6", "t7", "t8", "t9",
  "2", "3", "4", "5", "6", "7", "8", "9", "10", "11",
  "12", "13", "14", "15", "24", "25",
]);

/**
 * GCC rounds the outgoing argument area up to a multiple of 8 and never
 * emits less than 16 bytes, so an area of A bytes is consistent with a
 * widest call of n arguments for n in (A/4 - 2, A/4]. Report the range
 * rather than a false-precision single number.
 */
function argSlotRange(areaBytes: number): string {
  const high = Math.floor(areaBytes / 4);
  const low = Math.max(1, high - 1);
  return areaBytes <= 16 ? `up to ${high}` : `${low}-${high}`;
}

type Severity = "blocker" | "signal" | "info";

interface Finding {
  detector: string;
  severity: Severity;
  summary: string;
  evidence: string[];
  see: string[];
}

interface TargetFacts {
  frameSize: number;
  /** Offsets of true save slots (sw+lw pair for the same register). */
  saveSlots: Map<number, string>;
  /** Outgoing argument area size, inferred from the lowest save slot. */
  argAreaSize: number | null;
  /** Loads from the incoming argument region, keyed by caller-frame offset. */
  incomingLoads: { callerOffset: number; text: string; mnemonic: string }[];
  /** `sw $ra, 0(reg)` with a non-$sp base — the CAPTURE_RA seam. */
  raStores: string[];
  lines: string[];
}

/* --- assembly parsing --- */

function stripComment(line: string): string {
  return line.replace(/\/\*.*?\*\//g, " ").trim();
}

function parseHex(value: string): number {
  return value.startsWith("-")
    ? -parseInt(value.slice(1), value.slice(1).startsWith("0x") ? 16 : 10)
    : parseInt(value, value.startsWith("0x") ? 16 : 10);
}

function resolveTargetAsm(name: string): string | null {
  const candidates = [
    join(ROOT, "build/asm/nonmatchings", name, `${name}.s`),
    join(ROOT, "build/functions", `${name}.s`),
  ];
  return candidates.find((path) => existsSync(path)) ?? null;
}

function readTarget(name: string): TargetFacts | null {
  const path = resolveTargetAsm(name);
  if (!path) return null;

  const lines = readFileSync(path, "utf-8").split("\n").map(stripComment).filter(Boolean);

  let frameSize = 0;
  for (const line of lines) {
    const m = line.match(/^addiu\s+\$sp,\s*\$sp,\s*(-(?:0x)?[0-9a-fA-F]+)/);
    if (m) { frameSize = -parseHex(m[1]); break; }
  }

  /* A slot is a register save iff the same register is both stored to it and
   * reloaded from it. That discriminates prologue saves from outgoing
   * argument stores, which may also use callee-saved registers. */
  const stores = new Map<string, number>();
  const loads = new Set<string>();
  const incomingLoads: TargetFacts["incomingLoads"] = [];
  const raStores: string[] = [];

  for (const line of lines) {
    const store = line.match(/^(sw|sh|sb)\s+\$(\w+),\s*((?:0x)?[0-9a-fA-F]+)\(\$sp\)/);
    if (store) stores.set(`${store[2]}@${parseHex(store[3])}`, parseHex(store[3]));

    const load = line.match(/^(lw|lh|lhu|lb|lbu)\s+\$(\w+),\s*((?:0x)?[0-9a-fA-F]+)\(\$sp\)/);
    if (load) {
      const offset = parseHex(load[3]);
      loads.add(`${load[2]}@${offset}`);
      if (frameSize > 0 && offset >= frameSize) {
        incomingLoads.push({ callerOffset: offset - frameSize, text: line, mnemonic: load[1] });
      }
    }

    /* CAPTURE_RA seam: $ra stored through a register that is not $sp. */
    const raStore = line.match(/^sw\s+\$ra,\s*((?:0x)?0)\(\$(\w+)\)/);
    if (raStore && raStore[2] !== "sp") raStores.push(line);
    if (/^sw\s+\$ra,\s*%lo\(/.test(line)) raStores.push(line);
  }

  const saveSlots = new Map<number, string>();
  for (const [key, offset] of stores) {
    if (loads.has(key)) saveSlots.set(offset, key.split("@")[0]);
  }

  const argAreaSize = saveSlots.size > 0 ? Math.min(...saveSlots.keys()) : null;

  return { frameSize, saveSlots, argAreaSize, incomingLoads, raStores, lines };
}

/* --- compiling the current source --- */

interface CompiledFacts {
  frameSize: number;
  argAreaSize: number;
  savedRegs: number;
  varsSize: number;
  /** Each embedded asm block with the instructions that follow it. */
  asmBlocks: { insns: string[]; after: string[] }[];
}

function loadFlagOverrides(): Map<string, string> {
  const overrides = new Map<string, string>();
  const path = join(ROOT, "configs/flag_overrides.mk");
  if (!existsSync(path)) return overrides;
  for (const line of readFileSync(path, "utf-8").split("\n")) {
    const m = line.match(/^CC1FLAGS_(\S+)\s*:=\s*(.+)$/);
    if (m) overrides.set(m[1], m[2].trim());
  }
  return overrides;
}

function compileSource(name: string, src: string): CompiledFacts | null {
  const dir = join(ROOT, "build/triage");
  mkdirSync(dir, { recursive: true });
  const i = `build/triage/${name}.i`;
  const s = `build/triage/${name}.s`;
  const extra = loadFlagOverrides().get(name) || "";
  try {
    execSync(`${CPP} ${CPPFLAGS} ${src} -o ${i}`, { cwd: ROOT, stdio: ["pipe", "pipe", "pipe"] });
    execSync(`${CC} ${CC1FLAGS} ${extra} ${i} -o ${s}`, { cwd: ROOT, stdio: ["pipe", "pipe", "pipe"] });
  } catch {
    return null;
  }

  const lines = readFileSync(join(ROOT, s), "utf-8").split("\n");
  const frame = lines.find((line) => /\.frame\s+\$sp/.test(line));
  if (!frame) return null;

  const size = frame.match(/\.frame\s+\$sp,(\d+),/);
  const detail = frame.match(/vars=\s*(\d+),\s*regs=\s*(\d+)\/(\d+),\s*args=\s*(\d+)/);
  if (!size || !detail) return null;

  /* Collect each #APP/#NO_APP block together with the instructions that
   * follow it, so the dead-output check looks forward from its own seam. */
  const asmBlocks: CompiledFacts["asmBlocks"] = [];
  let current: string[] | null = null;
  lines.forEach((line, index) => {
    if (line.trim() === "#APP") { current = []; return; }
    if (line.trim() === "#NO_APP") {
      /* Every file opens with an `.include "include/macro.inc"` APP block;
       * it is boilerplate, not a reconstruction decision. */
      if (current && current.some((insn) => !/^\s*\./.test(insn))) {
        asmBlocks.push({ insns: current, after: lines.slice(index + 1).map((l) => l.trim()) });
      }
      current = null;
      return;
    }
    if (current && line.trim()) current.push(line.trim());
  });

  return {
    frameSize: parseInt(size[1], 10),
    argAreaSize: parseInt(detail[4], 10),
    savedRegs: parseInt(detail[2], 10),
    varsSize: parseInt(detail[1], 10),
    asmBlocks,
  };
}

/* --- detectors --- */

function hex(value: number): string {
  return `0x${value.toString(16).toUpperCase()}`;
}

function detectArityFrame(target: TargetFacts, compiled: CompiledFacts): Finding[] {
  const findings: Finding[] = [];
  if (compiled.frameSize === target.frameSize) return findings;

  const evidence = [
    `target frame ${hex(target.frameSize)}, compiled frame ${hex(compiled.frameSize)}`,
  ];
  if (target.argAreaSize !== null) {
    evidence.push(
      `target outgoing arg area ${hex(target.argAreaSize)} ` +
      `(lowest save slot), compiled ${hex(compiled.argAreaSize)}`
    );
  }
  evidence.push(
    `target saves ${target.saveSlots.size} register(s) ` +
    `[${[...target.saveSlots.entries()].sort((a, b) => a[0] - b[0]).map(([o, r]) => `$${r}@${hex(o)}`).join(" ")}], ` +
    `compiled saves ${compiled.savedRegs}`
  );

  const argAreaShort =
    target.argAreaSize !== null && compiled.argAreaSize < target.argAreaSize;
  const summary = argAreaShort
    ? "frame too small AND outgoing argument area too narrow — a CALLEE prototype is short " +
      `(target's widest call takes ${argSlotRange(target.argAreaSize!)} arguments, ` +
      `yours takes ${argSlotRange(compiled.argAreaSize)})`
    : compiled.frameSize < target.frameSize
      ? "frame too small — too few declared parameters, or missing locals"
      : "frame too large — too many declared parameters, or spurious locals";

  findings.push({
    detector: "arity-frame",
    severity: "signal",
    summary,
    evidence,
    see: [
      "notes/research/frame-size-arity-diagnostic.md",
      "notes/retros/func_80016B7C.md",
    ],
  });
  return findings;
}

function detectArityStack(target: TargetFacts): Finding[] {
  const stackArgs = target.incomingLoads.filter((load) => load.callerOffset >= 0x10);
  if (stackArgs.length === 0) return [];

  const maxOffset = Math.max(...stackArgs.map((load) => load.callerOffset));
  const minArity = maxOffset / 4 + 1;

  return [{
    detector: "arity-stack",
    severity: "signal",
    summary:
      `target reads incoming stack argument(s) — minimum arity ${minArity}. ` +
      "In O32 a load from $sp + framesize + 0x10 or above IS an incoming " +
      "stack parameter; it is never the caller's saved $ra.",
    evidence: stackArgs
      .sort((a, b) => a.callerOffset - b.callerOffset)
      .map((load) =>
        `${load.text}  ->  caller_sp+${hex(load.callerOffset)} = parameter #${load.callerOffset / 4 + 1}` +
        (load.mnemonic === "lw" ? "" : ` (${load.mnemonic}: narrow type)`)
      ),
    see: [
      "notes/research/frame-size-arity-diagnostic.md",
      "notes/retros/func_80016B7C.md",
    ],
  }];
}

function detectCaptureRa(target: TargetFacts): Finding[] {
  if (target.raStores.length === 0) return [];
  const handwritten = target.raStores.filter((line) => line.includes("%lo("));
  const hook = target.raStores.filter((line) => !line.includes("%lo("));
  const findings: Finding[] = [];

  if (hook.length > 0) {
    findings.push({
      detector: "capture-ra",
      severity: "signal",
      summary:
        "CAPTURE_RA debug-hook signature: $ra stored through a non-$sp base. " +
        "Use the CAPTURE_RA macro from include/debughook.h; this function will " +
        "also need an embedded-asm sourcePolicy allowlist entry.",
      evidence: hook,
      see: [
        "include/debughook.h",
        "notes/research/caller-capture-debug-hook.md",
      ],
    });
  }
  if (handwritten.length > 0) {
    findings.push({
      detector: "capture-ra",
      severity: "info",
      summary:
        "`sw $ra, %lo(SYM)($at)` — an assembler-expanded pseudo-op that GCC " +
        "never emits. This is the handwritten-assembly classification path, " +
        "not a C reconstruction target.",
      evidence: handwritten,
      see: ["notes/research/caller-capture-debug-hook.md"],
    });
  }
  return findings;
}

/** Look up a function's vram, so the allowlist can be keyed either way. */
function functionVram(name: string): string | undefined {
  const path = join(ROOT, "build/callGraph.json");
  if (!existsSync(path)) return undefined;
  try {
    const graph = JSON.parse(readFileSync(path, "utf-8"));
    return graph.functions?.find((f: { name: string }) => f.name === name)?.vram;
  } catch { return undefined; }
}

function allowlistFor(name: string): string[] {
  const policyPath = join(ROOT, ".pi/autodecomp.json");
  if (!existsSync(policyPath)) return [];
  try {
    const policy = JSON.parse(readFileSync(policyPath, "utf-8"));
    const list = policy?.sourcePolicy?.allowlist ?? {};
    /* The real checker keys on lowercased name OR vram. */
    const keys = [name.toLowerCase(), functionVram(name)?.toLowerCase()].filter(Boolean) as string[];
    return keys.flatMap((key) => list[key] ?? []);
  } catch { return []; }
}

/**
 * Mirrors .pi/extensions/psx-decomp/autonomous/source-policy.ts, with one
 * added discrimination the gate does not need but an agent does: a top-level
 * asm block that emits a whole function (`.globl`/`.ent`/`.text` in its
 * template) is an established handwritten-assembly reconstruction, not the
 * embedded-asm-inside-compiled-C failure mode this detector is hunting.
 */
function detectAsmPolicy(name: string, srcText: string): Finding[] {
  const stripped = srcText.replace(/\/\*[\s\S]*?\*\//g, " ");
  const asmLines = stripped
    .split("\n")
    .filter((line) => /\b(?:__asm__|__asm|asm)\s*(?:volatile\s*)?\(/.test(line));
  if (asmLines.length === 0) return [];

  const findings: Finding[] = [];
  const allowed = allowlistFor(name);

  const wholeFunction = /\.globl|\.ent\b|\\t\.text/.test(stripped);
  const barrierOnly = asmLines.every((line) =>
    /__asm__\s*(?:volatile\s*)?\(\s*""\s*:\s*:\s*:\s*"memory"\s*\)/.test(line.replace(/\s+/g, " "))
  );
  if (barrierOnly) return [];

  const usesRegisterAsm = /\bregister\b[^;\n]*\b(?:__asm__|__asm)\s*\(/.test(stripped);
  if (usesRegisterAsm && !allowed.includes("register-asm")) {
    findings.push({
      detector: "asm-policy",
      severity: "blocker",
      summary:
        `source pins hard registers (register-asm) but ${name} has no such entry ` +
        "in .pi/autodecomp.json sourcePolicy.allowlist — this cannot ship " +
        "regardless of its score.",
      evidence: [`allowlisted: ${allowed.length > 0 ? allowed.join(", ") : "(none)"}`],
      see: ["AGENTS.md", "prompts/c-style-guide.md"],
    });
  }

  if (wholeFunction) {
    findings.push({
      detector: "asm-policy",
      severity: "info",
      summary:
        "top-level asm emitting a whole function — the handwritten-assembly " +
        "reconstruction path, not embedded asm in compiled C. Confirm the " +
        "function's classification justifies it.",
      evidence: [asmLines[0].trim()],
      see: ["AGENTS.md"],
    });
    return findings;
  }

  if (!allowed.includes("embedded-asm")) {
    findings.push({
      detector: "asm-policy",
      severity: "blocker",
      summary:
        `source uses embedded asm but ${name} has no embedded-asm entry in ` +
        ".pi/autodecomp.json sourcePolicy.allowlist — this cannot ship regardless " +
        "of its score. Treat the missing entry as evidence the premise is wrong, " +
        "not as paperwork to file later.",
      evidence: [
        asmLines[0].trim(),
        `allowlisted: ${allowed.length > 0 ? allowed.join(", ") : "(none)"}`,
        "the gate scans changed files, so a pre-existing occurrence fires only once you modify this file",
      ],
      see: ["AGENTS.md", "prompts/c-style-guide.md"],
    });
  }
  return findings;
}

/**
 * Only meaningful when the asm declares an output operand. A clobber-only
 * block (CAPTURE_RA's `: : "r"(dst) : "$8"`) writes a scratch register by
 * design and has no output to be dead.
 */
function detectDeadAsm(compiled: CompiledFacts, srcText: string): Finding[] {
  /* Scoped to a single asm block. Multi-block hybrids interleave outputs
   * across regions, which this linear scan cannot model — and they are
   * established allowlisted exceptions rather than the failure mode here. */
  if (compiled.asmBlocks.length !== 1) return [];
  const hasOutputOperand = /:\s*"[=+]/.test(srcText.replace(/\/\*[\s\S]*?\*\//g, " "));
  if (!hasOutputOperand) return [];

  const block = compiled.asmBlocks[0];
  const written = new Set<string>();
  for (const insn of block.insns) {
    const m = insn.match(/^\s*[a-z]+[a-z0-9.]*\s+\$(\w+)\s*,/);
    if (m) written.add(m[1]);
  }
  if (written.size === 0) return [];

  const dead: string[] = [];
  for (const reg of written) {
    if (!CALL_CLOBBERED.has(reg)) continue;
    let readBeforeClobber = false;
    for (const line of block.after) {
      if (new RegExp(`\\$${reg}\\b`).test(line)) {
        /* A read counts only if the register is a source operand. */
        const operands = line.replace(/^\s*[a-z]+[a-z0-9.]*\s+/, "").split(",").map((o) => o.trim());
        if (operands.slice(1).some((o) => o.includes(`$${reg}`))) { readBeforeClobber = true; break; }
        if (operands[0] === `$${reg}`) break; /* redefined without being read */
      }
      if (/^\s*jal\b/.test(line)) break; /* call clobbers it */
    }
    if (!readBeforeClobber) dead.push(reg);
  }
  if (dead.length === 0) return [];

  return [{
    detector: "asm-dead",
    severity: "blocker",
    summary:
      `embedded asm writes $${dead.join(", $")} but the value is clobbered or ` +
      "redefined before any use — the asm block computes nothing that survives. " +
      "An asm whose output is dead is not modeling the target; the real " +
      "explanation is elsewhere.",
    evidence: block.insns,
    see: ["notes/retros/func_80016B7C.md"],
  }];
}

/* --- main --- */

function main(): void {
  const args = process.argv.slice(2);
  const json = args.includes("--json");
  const srcFlag = args.indexOf("--src");
  const srcOverride = srcFlag >= 0 ? args[srcFlag + 1] : null;
  const positional = args.filter(
    (a, i) => !a.startsWith("--") && !(srcFlag >= 0 && i === srcFlag + 1)
  );
  if (positional.length !== 1 || (srcFlag >= 0 && !srcOverride)) {
    console.error("Usage: npx tsx tools/agent/triage.ts <func_name> [--src <path.c>] [--json]");
    process.exit(1);
  }

  const name = positional[0].replace(/^src\//, "").replace(/\.c$/, "");
  const target = readTarget(name);
  if (!target) {
    console.error(`triage: no target assembly found for ${name} (run the split/build first)`);
    process.exit(1);
  }

  const findings: Finding[] = [];
  findings.push(...detectArityStack(target));
  findings.push(...detectCaptureRa(target));

  const srcPath = srcOverride ?? join(ROOT, "src", `${name}.c`);
  let sourceState: "missing" | "stub" | "c" = "missing";
  if (existsSync(srcPath)) {
    const srcText = readFileSync(srcPath, "utf-8");
    sourceState = /INCLUDE_ASM/.test(srcText) ? "stub" : "c";
    if (sourceState === "c") {
      findings.push(...detectAsmPolicy(name, srcText));
      const compiled = compileSource(name, srcOverride ?? `src/${name}.c`);
      if (compiled) {
        findings.push(...detectArityFrame(target, compiled));
        findings.push(...detectDeadAsm(compiled, srcText));
      }
    }
  }

  if (json) {
    console.log(JSON.stringify({ function: name, sourceState, findings }, null, 2));
    return;
  }

  const order: Severity[] = ["blocker", "signal", "info"];
  findings.sort((a, b) => order.indexOf(a.severity) - order.indexOf(b.severity));

  console.log(`triage ${name} — target frame ${hex(target.frameSize)}, source: ${sourceState}`);
  if (findings.length === 0) {
    console.log("\nno findings. No known symptom class matched; proceed with the normal loop.");
    return;
  }
  for (const finding of findings) {
    console.log(`\n[${finding.severity}] ${finding.detector}`);
    console.log(`  ${finding.summary}`);
    for (const line of finding.evidence) console.log(`    | ${line}`);
    console.log(`  see: ${finding.see.join(", ")}`);
  }
}

main();
