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
 * hypotheses) and scanReadBeforeDef.ts (register-variable fingerprints).
 *
 * Born from func_80016B7C, where ~20 variants were spent on a phantom inline
 * asm block because the frame-size signal for a missing parameter was never
 * read (notes/retros/func_80016B7C.md). Extended after a session was spent
 * hand-deriving a GPU primitive emitter that the SDK header names outright.
 *
 * Detectors:
 *   frame-map       exact frame decomposition and the signature it implies
 *   sdk-idiom       PSY-Q primitive types and macro expansions in the target
 *   inventory       order-independent content diff (offsets/constants/shifts)
 *   arity-frame     compiled frame decomposition vs target, component-wise
 *   arity-stack     loads from the incoming stack-argument region
 *   capture-ra      the CAPTURE_RA debug-hook signature in the target
 *   flag-fingerprint  symbolic lui/lw self-clobber pairs (per-file flag class)
 *   asm-policy      embedded asm without a sourcePolicy allowlist entry
 *   asm-dead        an embedded asm block whose output is clobbered unused
 *
 * Usage:
 *   npx tsx tools/agent/triage.ts func_80016B7C
 *   npx tsx tools/agent/triage.ts func_80016B7C --json
 *   npx tsx tools/agent/triage.ts func_80016B7C --src /tmp/experiment.c
 */

import { existsSync, readFileSync, rmSync } from "fs";
import { join } from "path";
import {
  ROOT,
  type DisassembledInstruction,
  assembleTarget,
  compileSource,
  disassembleObject,
  normalizeFunctionName,
  resolveSource,
} from "./decompToolchain.js";
import {
  type FrameMap,
  analyzeFrame,
  argSlotRange,
  minimumArity,
  renderMap,
  renderSignature,
} from "./frameMap.js";
import { recognizeIdioms } from "./sdkIdioms.js";
import { compareInventories, renderReport } from "./inventory.js";

/* Both spellings: target assembly uses names, cc1 output uses numbers. */
const CALL_CLOBBERED = new Set([
  "v0", "v1", "a0", "a1", "a2", "a3",
  "t0", "t1", "t2", "t3", "t4", "t5", "t6", "t7", "t8", "t9",
  "2", "3", "4", "5", "6", "7", "8", "9", "10", "11",
  "12", "13", "14", "15", "24", "25",
]);

type Severity = "blocker" | "signal" | "info";

interface Finding {
  detector: string;
  severity: Severity;
  summary: string;
  evidence: string[];
  see: string[];
}

/* --- target-side facts --- */

interface TargetFacts {
  frame: FrameMap;
  instructions: DisassembledInstruction[];
  /** `sw $ra, 0(reg)` with a non-$sp base — the CAPTURE_RA seam. */
  raStores: string[];
}

function stripComment(line: string): string {
  return line.replace(/\/\*.*?\*\//g, " ").trim();
}

function resolveTargetAsm(name: string): string | null {
  const candidates = [
    join(ROOT, "build/asm/nonmatchings", name, `${name}.s`),
    join(ROOT, "build/functions", `${name}.s`),
  ];
  return candidates.find((path) => existsSync(path)) ?? null;
}

/**
 * The CAPTURE_RA seam is read from the original assembly text rather than the
 * disassembly, because the handwritten-assembly spelling
 * (`sw $ra, %lo(SYM)($at)`) is an assembler pseudo-op that no longer looks
 * like itself after assembly.
 */
function readRaStores(name: string): string[] {
  const path = resolveTargetAsm(name);
  if (!path) return [];
  const raStores: string[] = [];
  for (const raw of readFileSync(path, "utf-8").split("\n")) {
    const line = stripComment(raw);
    const store = line.match(/^sw\s+\$ra,\s*((?:0x)?0)\(\$(\w+)\)/);
    if (store && store[2] !== "sp") raStores.push(line);
    if (/^sw\s+\$ra,\s*%lo\(/.test(line)) raStores.push(line);
  }
  return raStores;
}

/* --- compiled-side facts --- */

interface CompiledFacts {
  frameSize: number;
  argAreaSize: number;
  savedRegs: number;
  varsSize: number;
  instructions: DisassembledInstruction[];
  /** Each embedded asm block with the instructions that follow it. */
  asmBlocks: { insns: string[]; after: string[] }[];
}

function readCompiled(name: string, source: string, scratch: string): CompiledFacts | null {
  let artifacts;
  try {
    artifacts = compileSource(source, scratch, name, { assemble: true });
  } catch {
    return null;
  }

  const lines = readFileSync(artifacts.assembly, "utf-8").split("\n");
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
    instructions: artifacts.object ? disassembleObject(artifacts.object) : [],
    asmBlocks,
  };
}

/* --- detectors --- */

function hex(value: number): string {
  return `${value < 0 ? "-" : ""}0x${Math.abs(value).toString(16).toUpperCase()}`;
}

/**
 * Always reported. This is transcription, not diagnosis: the frame layout and
 * the load widths at the incoming slots determine the parameter list exactly,
 * and an agent that derives them by hand gets one wrong.
 */
function detectFrameMap(name: string, target: TargetFacts): Finding[] {
  return [{
    detector: "frame-map",
    severity: "info",
    summary:
      `target frame decomposition and the signature it implies ` +
      `(minimum arity ${minimumArity(target.frame)})`,
    evidence: [
      ...renderMap(name, target.frame),
      "",
      `signature: ${renderSignature(name, target.frame)}`,
      "stack parameter types are exact (load width and signedness); register parameters default to s32",
    ],
    see: ["notes/research/frame-size-arity-diagnostic.md"],
  }];
}

/**
 * The field map is the payload, and it is only worth printing while the
 * source has not adopted the type. Once it has, one confirming line is
 * enough — the rest would be wallpaper, and wallpaper gets skimmed.
 */
function detectSdkIdioms(target: TargetFacts, sourceText?: string): Finding[] {
  const report = recognizeIdioms(target.instructions, sourceText);
  if (!report.primitive) return [];

  const knowsType = sourceText ? new RegExp(`\\b${report.primitive.name}\\b`).test(sourceText) : false;
  const relevant = knowsType
    ? report.findings.filter((finding) => finding.kind === "sdk-primitive")
    : report.findings;

  return relevant.map((finding) => ({
    detector: "sdk-idiom",
    severity: (finding.kind === "sdk-primitive" && !knowsType ? "signal" : "info") as Severity,
    summary: finding.summary,
    evidence: knowsType ? [`source already uses ${report.primitive!.name}`] : finding.evidence,
    see: ["include/psyq/libgpu.h"],
  }));
}

function detectInventory(target: TargetFacts, compiled: CompiledFacts): Finding[] {
  if (compiled.instructions.length === 0) return [];
  const report = compareInventories(target.instructions, compiled.instructions);
  const total = report.memory.length + report.constants.length + report.shifts.length;
  if (total === 0) return [];

  const targetOnly = [...report.memory, ...report.constants, ...report.shifts]
    .filter((delta) => delta.compiled === 0).length;

  return [{
    detector: "inventory",
    severity: targetOnly > 0 ? "signal" : "info",
    summary:
      `${total} order-independent content difference(s)` +
      (targetOnly > 0
        ? `, ${targetOnly} of them present in the target and absent from your source. ` +
          "These multisets are invariant to scheduling and allocation, so a " +
          "difference here is a SEMANTIC defect — fix it before any ordering work."
        : ". Counts differ but nothing is missing outright."),
    evidence: [
      ...renderReport(report, 10),
      "",
      "target struct access, by base register:",
      ...[...report.targetByBase]
        .filter(([, offsets]) => offsets.size >= 2)
        .map(([base, offsets]) =>
          `  $${base}: ${[...offsets].sort((a, b) => a - b).map(hex).join(" ")}`),
    ],
    see: ["prompts/c-style-guide.md"],
  }];
}

function detectArityFrame(target: TargetFacts, compiled: CompiledFacts): Finding[] {
  const frame = target.frame;
  const varsMatch = frame.varsSize === null || frame.varsSize === compiled.varsSize;
  const argsMatch = frame.argAreaSize === compiled.argAreaSize;
  const savesMatch = frame.saveSlots.length === compiled.savedRegs;
  if (varsMatch && argsMatch && savesMatch && frame.frameSize === compiled.frameSize) return [];

  const evidence = [
    `frame        target ${hex(frame.frameSize)}   yours ${hex(compiled.frameSize)}`,
    `outgoing args target ${hex(frame.argAreaSize)}   yours ${hex(compiled.argAreaSize)}` +
      `   (widest call: ${frame.outgoingArgs} vs ${argSlotRange(compiled.argAreaSize)} slots)`,
    `locals/spills target ${frame.varsSize === null ? "?" : hex(frame.varsSize)}   yours ${hex(compiled.varsSize)}`,
    `saved regs   target ${frame.saveSlots.length}   yours ${compiled.savedRegs}`,
  ];

  const causes: string[] = [];
  if (!argsMatch) {
    causes.push(compiled.argAreaSize < frame.argAreaSize
      ? "outgoing argument area too narrow — a CALLEE prototype is short"
      : "outgoing argument area too wide — a CALLEE prototype has too many parameters");
  }
  if (!varsMatch) {
    causes.push(compiled.varsSize < (frame.varsSize ?? 0)
      ? "too few locals — a local array or spilled temporary is missing"
      : "too many locals — spurious temporaries, or a local that should be a register value");
  }
  if (!savesMatch) {
    causes.push(compiled.savedRegs < frame.saveSlots.length
      ? "too few saved registers — fewer live values than the target carries"
      : "too many saved registers — more live values than the target carries");
  }

  return [{
    detector: "arity-frame",
    severity: "signal",
    summary: causes.join("; ") || "frame decomposition differs",
    evidence,
    see: [
      "notes/research/frame-size-arity-diagnostic.md",
      "notes/retros/func_80016B7C.md",
    ],
  }];
}

function detectArityStack(target: TargetFacts): Finding[] {
  const incoming = target.frame.incoming;
  if (incoming.length === 0) return [];

  return [{
    detector: "arity-stack",
    severity: "signal",
    summary:
      `target reads incoming stack argument(s) — minimum arity ${minimumArity(target.frame)}. ` +
      "In O32 a load from $sp + framesize + 0x10 or above IS an incoming " +
      "stack parameter; it is never the caller's saved $ra.",
    evidence: incoming.map((argument) =>
      `${argument.evidence}  ->  caller_sp+${hex(argument.callerOffset)} = arg${argument.index} : ${argument.type}`),
    see: [
      "notes/research/frame-size-arity-diagnostic.md",
      "notes/retros/func_80016B7C.md",
    ],
  }];
}

/**
 * Symbolic lui/lw self-clobber pairs in the target: `lui $r, %hi(SYM)`
 * immediately followed by a load into $r through %lo(SYM)($r). Under the
 * baseline split-addresses codegen the lui is an independent insn that
 * sched2 lifts away from its load whenever the destination register has no
 * intervening hazard, so the ADJACENT pair is usually the unsplit
 * assembler-macro load — a per-file -mno-split-addresses fingerprint, and a
 * per-TU fact (func_800165D8/func_80016C08). Sequential pairs over several
 * registers can instead be the scheduling class (SetGfxClip precedent).
 * psx_flag_probe's matrix now carries both columns; it settles which.
 */
function detectFlagFingerprint(name: string): Finding[] {
  const path = resolveTargetAsm(name);
  if (!path) return [];
  const insns = readFileSync(path, "utf-8")
    .split("\n")
    .map(stripComment)
    .filter((line) => line && !line.startsWith(".") && !line.endsWith(":"));
  const pairs: string[] = [];
  for (let i = 0; i + 1 < insns.length; i++) {
    const hi = insns[i].match(/^lui\s+\$(\w+),\s*%hi\(([^)]+)\)/);
    if (!hi) continue;
    const lo = insns[i + 1].match(/^l\w+\s+\$(\w+),\s*%lo\(([^)]+)\)\(\$(\w+)\)/);
    if (lo && lo[1] === hi[1] && lo[3] === hi[1] && lo[2] === hi[2]) {
      pairs.push(`${insns[i]}  /  ${insns[i + 1]}`);
    }
  }
  if (pairs.length === 0) return [];

  const overrides = join(ROOT, "configs/flag_overrides.mk");
  const hasOverride = existsSync(overrides) &&
    new RegExp(`^CC1FLAGS_${name}\\s*:?=`, "m").test(readFileSync(overrides, "utf-8"));
  return [{
    detector: "flag-fingerprint",
    severity: hasOverride ? "info" : "signal",
    summary: hasOverride
      ? "symbolic lui/lw self-clobber pair(s); a per-file flag override already covers this function"
      : "symbolic lui/lw self-clobber pair(s) — likely the unsplit assembler-macro " +
        "load, unreachable under baseline split addresses (no source shape or " +
        "allocation pins the lui against sched2 unless another insn touches its " +
        "register). Run psx_flag_probe: its matrix carries -mno-split-addresses " +
        "and the scheduling columns, and file-groupings.md may record the flag " +
        "as this TU's fact. Apply per the style guide flag-hypothesis bar.",
    evidence: pairs,
    see: [
      "prompts/c-style-guide.md",
      "notes/research/func_800165D8-code-region-fold-and-allocation.md",
      "notes/research/func_80016C08-tu-owned-globals-and-gp-relative-addressing.md",
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
  const srcOverride = srcFlag >= 0 ? args[srcFlag + 1] : undefined;
  const positional = args.filter(
    (a, i) => !a.startsWith("--") && !(srcFlag >= 0 && i === srcFlag + 1)
  );
  if (positional.length !== 1 || (srcFlag >= 0 && !srcOverride)) {
    console.error("Usage: npx tsx tools/agent/triage.ts <func_name> [--src <path.c>] [--json]");
    process.exit(1);
  }

  const name = normalizeFunctionName(positional[0]);
  const scratch = join(ROOT, "build/triage", name);

  let target: TargetFacts;
  try {
    const instructions = disassembleObject(assembleTarget(name, scratch));
    target = { frame: analyzeFrame(instructions), instructions, raStores: readRaStores(name) };
  } catch (error) {
    rmSync(scratch, { recursive: true, force: true });
    console.error(`triage: no usable target assembly for ${name} — ${(error as Error).message}`);
    process.exit(1);
  }

  const findings: Finding[] = [];
  const srcPath = srcOverride ?? join(ROOT, "src", `${name}.c`);
  const srcText = existsSync(srcPath) ? readFileSync(srcPath, "utf-8") : undefined;
  const sourceState: "missing" | "stub" | "c" =
    srcText === undefined ? "missing" : /INCLUDE_ASM/.test(srcText) ? "stub" : "c";

  let frameConverged = false;
  if (sourceState === "c" && srcText !== undefined) {
    findings.push(...detectAsmPolicy(name, srcText));
    const compiled = readCompiled(name, resolveSource(name, srcOverride), scratch);
    if (compiled) {
      const arity = detectArityFrame(target, compiled);
      frameConverged = arity.length === 0;
      findings.push(...arity);
      findings.push(...detectInventory(target, compiled));
      findings.push(...detectDeadAsm(compiled, srcText));
    }
  }

  /* The frame map is reference data for authoring. Once the compiled frame
   * decomposes exactly like the target's, it has nothing left to tell you. */
  if (!frameConverged) findings.push(...detectFrameMap(name, target));
  findings.push(...detectArityStack(target));
  findings.push(...detectCaptureRa(target));
  findings.push(...detectFlagFingerprint(name));
  findings.push(...detectSdkIdioms(target, sourceState === "c" ? srcText : undefined));
  rmSync(scratch, { recursive: true, force: true });

  if (json) {
    console.log(JSON.stringify({ function: name, sourceState, findings }, null, 2));
    return;
  }

  const order: Severity[] = ["blocker", "signal", "info"];
  findings.sort((a, b) => order.indexOf(a.severity) - order.indexOf(b.severity));

  console.log(`triage ${name} — target frame ${hex(target.frame.frameSize)}, source: ${sourceState}`);
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
