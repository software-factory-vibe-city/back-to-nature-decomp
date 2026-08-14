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
 *   param-residence memory-resident parameters: re-read incoming slots and
 *                   home-slot stores of register arguments
 *   undeclared-callee  calls with no declaration in scope (implicit int)
 *   capture-ra      the CAPTURE_RA debug-hook signature in the target
 *   loop-nesting    nested back-edge ranges need nested source loops
 *   loop-idiom      countdown latches mean count-up source reversed by loop.c
 *   backend-packet  all-loads-then-all-stores runs from one block-move insn
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
  detectImplicitDeclarations,
  disassembleObject,
  normalizeFunctionName,
  resolveSource,
} from "./decompToolchain.js";
import {
  type FrameMap,
  type ReturnValue,
  analyzeFrame,
  analyzeReturnValue,
  argSlotRange,
  maximumArity,
  memoryOperand,
  minimumArity,
  registerOf,
  renderMap,
  renderSignature,
} from "./frameMap.js";
import { recognizeIdioms, sdkReconstructionGap } from "./sdkIdioms.js";
import { readReport, targetHashOf, toolchainHash, type FlagProbeReport } from "./flagProbe.js";
import { sha256 } from "./variant-lab/artifacts.js";
import { compareInventories, renderReport } from "./inventory.js";
import { BRANCH_MNEMONICS, defUse } from "./webAnalysis.js";

/* Both spellings: target assembly uses names, cc1 output uses numbers. */
const CALL_CLOBBERED = new Set([
  "v0", "v1", "a0", "a1", "a2", "a3",
  "t0", "t1", "t2", "t3", "t4", "t5", "t6", "t7", "t8", "t9",
  "2", "3", "4", "5", "6", "7", "8", "9", "10", "11",
  "12", "13", "14", "15", "24", "25",
]);

type Severity = "blocker" | "signal" | "info";

export interface Finding {
  detector: string;
  severity: Severity;
  summary: string;
  evidence: string[];
  see: string[];
}

/* --- target-side facts --- */

export interface TargetFacts {
  frame: FrameMap;
  instructions: DisassembledInstruction[];
  returnValue: ReturnValue;
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
  /** Callees the TU never declares — C89 implicit int at each call site. */
  implicitCallees: string[];
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
    implicitCallees: detectImplicitDeclarations(artifacts.preprocessed, name),
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
  const minimum = minimumArity(target.frame);
  const maximum = maximumArity(target.frame);
  return [{
    detector: "frame-map",
    severity: "info",
    summary:
      `target frame decomposition and the signature it establishes ` +
      (minimum === maximum ? `(arity ${minimum})` : `(arity ${minimum}..${maximum})`),
    evidence: [
      ...renderMap(name, target.frame),
      "",
      `return value (${target.returnValue.basis}): ${target.returnValue.type}`,
      ...target.returnValue.evidence.map((line) => `  ${line}`),
      "",
      `signature: ${renderSignature(name, target.frame, target.returnValue)}`,
      "stack parameter types are exact (load width and signedness); register parameters default to s32",
      "arity counts only parameters whose incoming value is read — an unused parameter is invisible here",
    ],
    see: ["notes/research/frame-size-arity-diagnostic.md"],
  }];
}

/**
 * A recognized SDK packet is a source-semantics finding, not a style
 * suggestion: hand-written field stores and 24-bit tag arithmetic where the
 * configured SDK has macros put the operation boundaries in the wrong place,
 * and every allocation or scheduling reading taken on top of them is taken on
 * the wrong program. So this runs BEFORE the inventory and frame detectors,
 * and it stays a signal until the source expresses the recognized operations.
 *
 * The field map is the payload while the source has not adopted the type.
 * Once it has, one confirming line is enough — the rest would be wallpaper,
 * and wallpaper gets skimmed.
 */
const SDK_BOUNDARY_INSTRUCTION =
  "Restore the SDK operation boundary before allocator or scheduler work. " +
  "Hand-written field stores and 24-bit tag arithmetic are a reconstruction " +
  "defect when the configured SDK provides these macros.";

function detectSdkIdioms(target: TargetFacts, sourceText?: string): Finding[] {
  const report = recognizeIdioms(target.instructions, sourceText);
  const gap = sdkReconstructionGap(report, sourceText);
  if (!gap) return [];

  const names = gap.types.length > 0 ? gap.types.join(", ") : "SDK tag operations";

  /* No source yet: the whole report is authoring reference. */
  if (sourceText === undefined) {
    return [{
      detector: "sdk-idiom",
      severity: "signal",
      summary:
        `target builds ${names} through the configured PSY-Q SDK. ${SDK_BOUNDARY_INSTRUCTION}`,
      evidence: report.findings.flatMap((finding) => [finding.summary, ...finding.evidence.map((line) => `  ${line}`)]),
      see: ["include/psyq/libgpu.h", "notes/retros/2026-08-13-func_800134C4-retro.md"],
    }];
  }

  if (gap.complete) {
    return [{
      detector: "sdk-idiom",
      severity: "info",
      summary:
        `source expresses every recognized SDK operation (${gap.types.join(", ") || "tag links"}: ` +
        `${gap.macros.join(", ")}) — the operation boundary is already restored`,
      evidence: [],
      see: ["include/psyq/libgpu.h"],
    }];
  }

  if (gap.missingTypes.length > 0) {
    return [{
      detector: "sdk-idiom",
      severity: "signal",
      summary:
        `target builds ${names}, and your source does not use ` +
        `${gap.missingTypes.join(", ")}. ${SDK_BOUNDARY_INSTRUCTION}`,
      evidence: report.findings.flatMap((finding) => [finding.summary, ...finding.evidence.map((line) => `  ${line}`)]),
      see: ["include/psyq/libgpu.h", "notes/retros/2026-08-13-func_800134C4-retro.md"],
    }];
  }

  /* The type is adopted but some operation is still expanded by hand. */
  return [{
    detector: "sdk-idiom",
    severity: "signal",
    summary:
      `source uses ${gap.types.join(", ")} but still expands ${gap.missingMacros.join(", ")} by hand. ` +
      SDK_BOUNDARY_INSTRUCTION,
    evidence: report.findings
      .filter((finding) => finding.kind === "sdk-macro" || finding.kind === "sdk-link")
      .flatMap((finding) => [finding.summary, ...finding.evidence.map((line) => `  ${line}`)]),
    see: ["include/psyq/libgpu.h", "notes/retros/2026-08-13-func_800134C4-retro.md"],
  }];
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

/**
 * Look up a callee's known-good declaration so the finding is actionable.
 * include/functions.h accumulates the signature of every matched function.
 */
function knownDeclaration(callee: string): string | undefined {
  const path = join(ROOT, "include/functions.h");
  if (!existsSync(path)) return undefined;
  const pattern = new RegExp(`[\\s\\*]${callee}\\s*\\(.*\\)\\s*;`);
  return readFileSync(path, "utf-8")
    .split("\n")
    .find((line) => pattern.test(line))
    ?.trim();
}

/**
 * An undeclared callee is C89 implicit int: the call defines `$v0`, and local
 * allocation then excludes `$v0` for every temporary born between that call
 * and the next explicit `$v0` write. The defect sits in the TU's
 * declarations, outside the function body, so no body rewrite can undo the
 * rotation it causes — and the target itself usually proves the real
 * signature (post-call `$v0` scratch use means the callee returns nothing).
 */
function detectUndeclaredCallee(compiled: CompiledFacts): Finding[] {
  if (compiled.implicitCallees.length === 0) return [];

  return [{
    detector: "undeclared-callee",
    severity: "blocker",
    summary:
      `${compiled.implicitCallees.length} callee(s) have no declaration in scope — C89 ` +
      "implicit int, so each call defines $v0 and poisons post-call scratch " +
      "allocation from outside the function body. Declare every callee with " +
      "its evidenced signature before any shape or allocation work.",
    evidence: compiled.implicitCallees.map((callee) => {
      const declaration = knownDeclaration(callee);
      return declaration
        ? `${callee} — declare:  ${declaration}`
        : `${callee} — no known signature; read its matched source, or its target ` +
          "(post-call $v0 scratch use = void; $v0 consumed = value-returning)";
    }),
    see: [
      "prompts/c-style-guide.md",
      "notes/retros/2026-08-06-func_80022738-retro.md",
    ],
  }];
}

/**
 * Loop structure is readable from the target alone: a branch to an earlier
 * address is a back-edge, and each one closes a loop whose header is that
 * address. Two back-edges whose ranges nest are two nested loops, and the
 * source must nest too — a flattened loop with `continue` reaches the same
 * behaviour but not the same code, because it changes which expressions are
 * loop-invariant and therefore where they can be hoisted to.
 *
 * This is cheap and needs no candidate source, so it runs on a bare stub
 * before any variant is written.
 */
export function detectLoopNesting(target: TargetFacts): Finding[] {
  const instructions = target.instructions;
  const indexOfAddress = new Map<number, number>();
  instructions.forEach((insn, index) => indexOfAddress.set(insn.address, index));

  const loops: { header: number; latch: number }[] = [];
  instructions.forEach((insn, index) => {
    if (!BRANCH_MNEMONICS.has(insn.mnemonic.toLowerCase())) return;
    const last = insn.operands[insn.operands.length - 1];
    const matched = last?.trim().match(/^(?:0x)?([0-9a-f]+)\b/i);
    if (!matched) return;
    const header = indexOfAddress.get(parseInt(matched[1]!, 16));
    if (header === undefined || header >= index) return;
    loops.push({ header, latch: index });
  });
  if (loops.length < 2) return [];

  /* One header reached by several latches is still one loop. */
  const byHeader = new Map<number, number>();
  for (const loop of loops) byHeader.set(loop.header, Math.max(byHeader.get(loop.header) ?? 0, loop.latch));
  const distinct = [...byHeader.entries()].map(([header, latch]) => ({ header, latch }))
    .sort((a, b) => a.header - b.header);
  if (distinct.length < 2) return [];

  const nested = distinct.some((outer) => distinct.some((inner) =>
    inner !== outer && outer.header < inner.header && inner.latch < outer.latch));
  if (!nested) return [];

  return [{
    detector: "loop-nesting",
    severity: "signal",
    summary:
      `target has ${distinct.length} back-edges to ${distinct.length} distinct headers, and their ` +
      "ranges nest — the source needs nested loops, not one loop with `continue`. " +
      "Expressions computed between the outer and inner header are invariant in the inner " +
      "loop; flattening makes them vary, and no source reordering recovers the position.",
    evidence: [
      ...distinct.map((loop) =>
        `header ${hex(instructions[loop.header]!.address)} <- back-edge ${hex(instructions[loop.latch]!.address)}  ${instructions[loop.latch]!.raw.trim()}`),
      ...(distinct.length >= 2 && distinct[0]!.header + 1 < distinct[1]!.header
        ? instructions.slice(distinct[0]!.header, distinct[1]!.header)
            .map((insn) => `  invariant in inner loop: ${insn.raw.trim()}`)
        : []),
    ],
    see: [
      "notes/retros/2026-08-07-func_80013B04-retro.md",
    ],
  }];
}

/**
 * A countdown loop in the target — a `-1` step on a register that a backward
 * branch tests against zero — is normally check_dbra_loop's REVERSAL of
 * count-up source, not a source-level countdown. The trap is that a
 * hand-written countdown do-while byte-matches the loop BODY, so it survives
 * every body-level experiment while putting the pass-time geometry in a
 * different, often unreachable state: the reversal path runs through jump.c's
 * while/for conversion (VTOP note) and creates the `counter = bound` init
 * during loop pass 1, which changes preheader block contents at gcse time,
 * PRE insertion sites, and register live lengths.
 *
 * Author count-up source FIRST (`for (i = 0; i < bound; i++)`, or `while`
 * with an explicit trailing `i++` when later statements must follow the
 * decrement in the emitted loop bottom). Two gates decide whether the
 * reversal fires at all: the exit test must be a signed `LT` (an unsigned
 * bound leaves the loop count-up with an `sltu`), and a `beqz` guard on the
 * bound is still consistent with count-up when the bound is provably
 * non-negative. Only fall back to a hand-written countdown after the
 * count-up family is measured.
 *
 * This is cheap and needs no candidate source, so it runs on a bare stub
 * before the first variant is written.
 */
export function detectLoopIdiom(target: TargetFacts): Finding[] {
  const instructions = target.instructions;
  const indexOfAddress = new Map<number, number>();
  instructions.forEach((insn, index) => indexOfAddress.set(insn.address, index));

  const reg = (operand: string | undefined): string | null => {
    const m = operand?.trim().match(/^\$?(\w+)$/);
    return m ? m[1]! : null;
  };

  /* Two reversal flavors: a register bound reverses to `counter != 0`
   * (bnez), a constant bound to `counter - 1 >= 0` (bgez) — check_dbra's
   * "vanilla" path. Both come from count-up source. */
  const countdowns: { header: number; latch: number; counter: string }[] = [];
  instructions.forEach((insn, index) => {
    const mnemonic = insn.mnemonic.toLowerCase();
    if (mnemonic !== "bnez" && mnemonic !== "bne" && mnemonic !== "bgez") return;
    const tested = reg(insn.operands[0]);
    if (!tested) return;
    if (mnemonic === "bne" && reg(insn.operands[1]) !== "zero") return;
    const last = insn.operands[insn.operands.length - 1];
    const matched = last?.trim().match(/^(?:0x)?([0-9a-f]+)\b/i);
    if (!matched) return;
    const header = indexOfAddress.get(parseInt(matched[1]!, 16));
    if (header === undefined || header >= index) return;

    /* Scan back from the branch to the loop header for the first insn that
     * writes the tested register — the scheduler can move the step
     * arbitrarily far from the latch — and require it to be the -1 step.
     * The delay slot is also a legal home for it. The scan is linear, not
     * CFG-aware, so a conditional def in a side arm stops it: that
     * under-reports, never over-reports. */
    const isDecrement = (candidate: DisassembledInstruction | undefined): boolean =>
      candidate !== undefined
      && candidate.mnemonic.toLowerCase() === "addiu"
      && reg(candidate.operands[0]) === tested
      && reg(candidate.operands[1]) === tested
      && /^-(0x)?1$/i.test(candidate.operands[2]?.trim() ?? "");
    /* Writer check is local rather than defUse-based: binutils spells $30
     * as "s8", which the shared web-register list only knows as "fp", and a
     * countdown in $s8 must not be invisible. Destination-first holds for
     * everything except stores, branches, and hi/lo writers. */
    const NON_WRITING = new Set(["sb", "sh", "sw", "swl", "swr", "mult", "multu", "div", "divu"]);
    const writesTested = (candidate: DisassembledInstruction): boolean => {
      const m = candidate.mnemonic.toLowerCase();
      if (BRANCH_MNEMONICS.has(m) || NON_WRITING.has(m)) return false;
      return reg(candidate.operands[0]) === tested;
    };
    let step: DisassembledInstruction | undefined;
    for (let back = index - 1; back >= header; back--) {
      const candidate = instructions[back];
      if (!candidate) break;
      if (writesTested(candidate)) {
        step = candidate;
        break;
      }
    }
    const delaySlot = instructions[index + 1];
    if (!isDecrement(step) && !isDecrement(delaySlot)) return;

    countdowns.push({ header, latch: index, counter: tested });
  });
  if (countdowns.length === 0) return [];

  const byHeader = new Map<number, { header: number; latch: number; counter: string }>();
  for (const loop of countdowns) if (!byHeader.has(loop.header)) byHeader.set(loop.header, loop);
  const distinct = [...byHeader.values()].sort((a, b) => a.header - b.header);

  return [{
    detector: "loop-idiom",
    severity: "signal",
    summary:
      `target has ${distinct.length} countdown loop(s) (register stepped by -1 into a bnez ` +
      "back-edge). Default to COUNT-UP source and let check_dbra_loop reverse it; a " +
      "hand-written countdown do-while byte-matches the loop body while placing VTOP, the " +
      "bound init, gcse-PRE preheader insertions, and live lengths in a different state " +
      "that no body-level or mechanism-level edit can recover. Reversal requires a signed " +
      "LT exit test (bound type matters), and the increment's source position controls the " +
      "emitted decrement slot. Hand-written countdown is the measured fallback, not the default.",
    evidence: distinct.map((loop) =>
      `header ${hex(instructions[loop.header]!.address)} <- countdown latch ${hex(instructions[loop.latch]!.address)} on $${loop.counter}`),
    see: [
      "prompts/c-style-guide.md",
      "notes/research/func_80017300-pre-placement-and-movable-order.md",
    ],
  }];
}

/** Bytes moved by each load/store mnemonic in a block-copy chunk. */
const COPY_WIDTHS: Record<string, number> = {
  lb: 1, lbu: 1, sb: 1, lh: 2, lhu: 2, sh: 2, lw: 4, sw: 4,
};

function copyOperand(operand: string): { offset: number; base: string } | null {
  const m = operand.trim().match(/^(-?(?:0x)?[0-9a-fA-F]+)?\(\$?(\w+)\)$/);
  if (!m) return null;
  const raw = m[1];
  const offset = !raw ? 0 : /^-?0x/i.test(raw) ? parseInt(raw, 16) : parseInt(raw, 10);
  return { offset, base: m[2]! };
}

/**
 * A run of N loads from one base at contiguous offsets, followed by N stores
 * to one base at contiguous offsets, carrying the same registers in order, is
 * what GCC's MIPS block mover emits: `output_block_move` issues every load of
 * a batch before any store of it, up to four chunks at a time.
 *
 * This reports compatibility, never provenance. The measured thresholds matter
 * as much as the shape, because outside them the geometry proves nothing:
 * at four-byte alignment a copy of 32 bytes or less is `move_by_pieces`, whose
 * interleaved output a member-wise scalar source reproduces byte-for-byte. So
 * an all-loads-then-all-stores run is only informative where `move_by_pieces`
 * would not have been chosen.
 */
export function detectBackendPacket(target: TargetFacts): Finding[] {
  const instructions = target.instructions;
  const findings: Finding[] = [];

  const isCopyLoad = (insn: DisassembledInstruction | undefined): boolean =>
    insn !== undefined && COPY_WIDTHS[insn.mnemonic.toLowerCase()] !== undefined
    && defUse(insn).isLoad && copyOperand(insn.operands[1] ?? "") !== null;

  for (let index = 0; index < instructions.length; index++) {
    let end = index;
    while (end < instructions.length && isCopyLoad(instructions[end])) end++;
    const count = end - index;
    if (count < 2) continue;
    if (end + count > instructions.length) continue;

    const loads = instructions.slice(index, end);
    const stores = instructions.slice(end, end + count);
    if (!stores.every((insn) => COPY_WIDTHS[insn.mnemonic.toLowerCase()] !== undefined
                             && defUse(insn).isStore && copyOperand(insn.operands[1] ?? ""))) continue;
    if (!loads.every((load, slot) => load.operands[0] === stores[slot]!.operands[0])) continue;

    const width = COPY_WIDTHS[loads[0]!.mnemonic.toLowerCase()]!;
    if (loads.some((insn) => COPY_WIDTHS[insn.mnemonic.toLowerCase()] !== width)) continue;
    if (stores.some((insn) => COPY_WIDTHS[insn.mnemonic.toLowerCase()] !== width)) continue;

    const source = loads.map((insn) => copyOperand(insn.operands[1] ?? "")!);
    const destination = stores.map((insn) => copyOperand(insn.operands[1] ?? "")!);
    const contiguous = (parts: { offset: number; base: string }[]) =>
      parts.every((part, slot) => part.base === parts[0]!.base
        && (slot === 0 || part.offset === parts[slot - 1]!.offset + width));
    if (!contiguous(source) || !contiguous(destination)) continue;
    /* A base redefined by one of the loads is not one base. */
    if (loads.some((insn) => insn.operands[0]?.replace("$", "") === source[0]!.base
                          || insn.operands[0]?.replace("$", "") === destination[0]!.base)) continue;

    const bytes = count * width;
    /* At word alignment this size would have been move_by_pieces, whose
     * interleaved output scalar source reproduces exactly — so a packet here
     * is only meaningful if the record is under-aligned. */
    const alignmentNote = width === 4 && bytes <= 32
      ? "word-aligned and 32 bytes or less would normally be move_by_pieces; " +
        "this run is a loop body or an under-aligned record"
      : `alignment below ${width === 1 ? "2" : "4"} is what selects byte/halfword chunks here`;

    findings.push({
      detector: "backend-packet",
      severity: "signal",
      summary:
        `target instructions ${index}..${end + count - 1} are compatible with ONE block-move RTL ` +
        `instruction (${bytes} bytes, ${count} x ${width}-byte chunks), not ${count * 2} independent ` +
        "loads and stores. Test a whole-object assignment before allocator or scheduler work — " +
        "scalarizing this instruction makes its registers and schedule unreachable from any source order.",
      evidence: [
        ...loads.map((insn) => insn.raw.trim()),
        ...stores.map((insn) => insn.raw.trim()),
        `source ${source[0]!.base}+${source[0]!.offset}, destination ${destination[0]!.base}+${destination[0]!.offset}`,
        alignmentNote,
        "compatibility only: this geometry does not prove the original source used an aggregate copy",
      ],
      see: [
        "notes/research/func_800140C8-aggregate-copy.md",
        "notes/retros/2026-08-07-func_800140C8-retro.md",
        "plans/backend-packet-and-aggregate-copy-automation.md",
      ],
    });
    index = end + count - 1;
  }
  return findings;
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
 * Parameter-residence fingerprints in the target.
 *
 * (a) Memory-resident stack parameter: an incoming stack-argument slot read
 *     MORE THAN ONCE. A register-resident parameter is copied out of its
 *     slot exactly once near entry; per-use re-loads mean the value lived
 *     in the slot across the function. Two originals produce that byte
 *     pattern: the parameter's pseudo lost register allocation and reload
 *     spilled it to its home slot (high pressure), or the declaration made
 *     the parameter memory-resident outright — an address-taken parameter,
 *     or a small under-aligned aggregate parameter (a 4-byte char-array
 *     struct is BLKmode on strict-alignment MIPS, and assign_parms then
 *     leaves it in its slot with NO entry-copy insn).
 *
 * (b) Homed register argument: $a0-$a3 stored into its OWN incoming home
 *     slot (framesize + 4n) and read back later. Same dual reading: a
 *     reload spill of a call-crossing argument, or an assign_parms home
 *     store for a memory-resident register parameter.
 *
 * Why it matters even though both readings emit the same bytes: the two
 * originals differ in pass-time geometry. A register-resident parameter
 * contributes an entry-copy/load insn to block 0's RTL stream whose
 * dependences (and stream position) constrain every scheduling and
 * allocation decision around it; a memory-resident one contributes nothing
 * there. When allocation or scheduling work stalls around these slots — an
 * entry weave that will not settle, a home store pinned away from its
 * target slot, anti-dependences radiating from parameter loads — test the
 * memory-resident declaration (the BLK aggregate parameter) before deeper
 * scheduler forensics. Detection is compatibility, not provenance: the
 * byte oracle still decides which reading the original used.
 */
export function detectParamResidence(target: TargetFacts): Finding[] {
  const frameSize = target.frame.frameSize;
  if (frameSize <= 0) return [];

  const ARG_HOME: Record<string, number> = { a0: 0, a1: 4, a2: 8, a3: 12 };
  const slotLoads = new Map<number, string[]>();
  const homeStores = new Map<number, string>();
  const homeLoads = new Map<number, string>();

  for (const insn of target.instructions) {
    const { isLoad, isStore } = defUse(insn);
    if (!isLoad && !isStore) continue;
    const memory = memoryOperand(insn.operands[insn.operands.length - 1] ?? "");
    if (!memory || memory.base !== "sp" || memory.offset < frameSize) continue;
    const register = registerOf(insn.operands[0] ?? "");
    const home = memory.offset - frameSize;

    if (isLoad) {
      if (home >= 0x10) {
        slotLoads.set(memory.offset, [...(slotLoads.get(memory.offset) ?? []), insn.raw.trim()]);
      } else if (!homeLoads.has(home)) {
        homeLoads.set(home, insn.raw.trim());
      }
    }
    if (isStore && register !== null && ARG_HOME[register] === home) {
      homeStores.set(home, insn.raw.trim());
    }
  }

  const findings: Finding[] = [];
  const see = [
    "notes/research/param-residence-playbook.md",
    "notes/retros/2026-08-14-func_80014CBC-retro.md",
  ];

  const rereads = [...slotLoads.entries()].filter(([, loads]) => loads.length >= 2);
  if (rereads.length > 0) {
    findings.push({
      detector: "param-residence",
      severity: "signal",
      summary:
        "incoming stack-argument slot(s) re-read per use — the parameter lived in its slot. " +
        "Either its pseudo was reload-spilled to the home slot, or the original declaration " +
        "was memory-resident (address-taken, or a BLKmode 4-byte char-array struct parameter " +
        "with no entry copy). If entry-block scheduling or allocation will not settle, test " +
        "the BLK-struct declaration before scheduler forensics.",
      evidence: rereads.flatMap(([offset, loads]) =>
        loads.map((line) => `${line}  ->  caller_sp+${hex(offset - frameSize)} read ${loads.length}x`)),
      see,
    });
  }

  const homed = [...homeStores.entries()].filter(([home]) => homeLoads.has(home));
  if (homed.length > 0) {
    findings.push({
      detector: "param-residence",
      severity: "signal",
      summary:
        "register argument stored to its own incoming home slot and read back — a " +
        "compiler-emitted homing, not a source statement. Either reload spilled a " +
        "call-crossing argument to its home, or assign_parms homed a memory-resident " +
        "parameter. The store's schedule slot is decided by dependences C cannot spell " +
        "directly; if it pins away from its target position, see the cited retro.",
      evidence: homed.map(([home, line]) =>
        `${line}  /  ${homeLoads.get(home)}  (arg${home / 4} home slot)`),
      see,
    });
  }

  return findings;
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
/**
 * A cached probe conclusion counts only when it was measured on this exact
 * function, source, target, and toolchain. Anything else is a claim about a
 * program that no longer exists, and a stale "the flag is not the answer"
 * costs more than no answer at all.
 */
export function flagProbeConclusion(
  name: string,
  srcText: string | undefined,
): { report: FlagProbeReport; fresh: true } | { report: FlagProbeReport | null; fresh: false; reason: string } {
  const report = readReport(name);
  if (!report) return { report: null, fresh: false, reason: "no flagProbe report has been written for this function" };
  const sourceHash = srcText === undefined ? null : sha256(srcText);
  if (report.sourceHash !== sourceHash) {
    return { report, fresh: false, reason: "the probe measured a different source than the one being analysed" };
  }
  if (report.targetHash !== (targetHashOf(name) ?? "")) {
    return { report, fresh: false, reason: "the target assembly changed since the probe ran" };
  }
  if (report.toolchainHash !== toolchainHash()) {
    return { report, fresh: false, reason: "the toolchain changed since the probe ran" };
  }
  return { report, fresh: true };
}

function detectFlagFingerprint(name: string, srcText?: string): Finding[] {
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
  const see = [
    "prompts/c-style-guide.md",
    "notes/research/func_800165D8-code-region-fold-and-allocation.md",
    "notes/research/func_80016C08-tu-owned-globals-and-gp-relative-addressing.md",
  ];
  if (hasOverride) {
    return [{
      detector: "flag-fingerprint",
      severity: "info",
      summary: "symbolic lui/lw self-clobber pair(s); a per-file flag override already covers this function",
      evidence: pairs,
      see,
    }];
  }

  /* The fingerprint is a fact about the target and stays in the evidence
   * whatever the probe said. What a fresh measurement changes is whether the
   * flag is still the ACTIVE remedy to chase. */
  const cached = flagProbeConclusion(name, srcText);
  if (cached.fresh && cached.report.conclusion === "not-supported-current-source") {
    return [{
      detector: "flag-fingerprint",
      severity: "info",
      summary:
        "symbolic lui/lw self-clobber pair(s) in the target, but a fresh psx_flag_probe run measured " +
        "the current source does not support this flag hypothesis; continue source-shape/SDK " +
        "reconstruction. The fingerprint stands — it is scoped to this source, not to every source shape.",
      evidence: [
        ...pairs,
        ...cached.report.candidates.map((candidate) => `${candidate.label}: ${candidate.reason}`),
      ],
      see,
    }];
  }
  if (cached.fresh && cached.report.conclusion === "supported") {
    return [{
      detector: "flag-fingerprint",
      severity: "signal",
      summary:
        "symbolic lui/lw self-clobber pair(s), and a fresh psx_flag_probe run measured a dominant flag " +
        `column on the current source (${cached.report.dominantRows.join(", ")}). Apply the style guide's ` +
        "flag-hypothesis bar: fingerprint + dominant column + no contrary regional witness.",
      evidence: [
        ...pairs,
        ...cached.report.candidates
          .filter((candidate) => candidate.conclusion === "supported")
          .map((candidate) => candidate.reason),
      ],
      see,
    }];
  }

  return [{
    detector: "flag-fingerprint",
    severity: "signal",
    summary:
      "symbolic lui/lw self-clobber pair(s) — likely the unsplit assembler-macro " +
      "load, unreachable under baseline split addresses (no source shape or " +
      "allocation pins the lui against sched2 unless another insn touches its " +
      "register). Run psx_flag_probe: its matrix carries -mno-split-addresses " +
      "and the scheduling columns, and file-groupings.md may record the flag " +
      "as this TU's fact. Apply per the style guide flag-hypothesis bar.",
    evidence: [
      ...pairs,
      cached.fresh
        ? `a fresh probe exists but its conclusion is ${cached.report.conclusion}`
        : `no fresh probe conclusion: ${cached.reason}`,
    ],
    see,
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
    /* `__volatile__` too — the C89 spelling this project's sources use. */
    .filter((line) => /\b(?:__asm__|__asm|asm)\s*(?:(?:__)?volatile(?:__)?\s*)?\(/.test(line));
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
        /* A read counts only if the register is a source operand — except on a
         * branch, whose first operand is compared, not written. Reading it as a
         * destination reports a live value as dead. */
        const mnemonic = (line.trim().match(/^[a-z][a-z0-9.]*/) ?? [""])[0];
        const isBranch = BRANCH_MNEMONICS.has(mnemonic);
        const operands = line.replace(/^\s*[a-z]+[a-z0-9.]*\s+/, "").split(",").map((o) => o.trim());
        const sources = isBranch ? operands : operands.slice(1);
        if (sources.some((o) => o.includes(`$${reg}`))) { readBeforeClobber = true; break; }
        if (!isBranch && operands[0] === `$${reg}`) break; /* redefined without being read */
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
    target = {
      frame: analyzeFrame(instructions),
      instructions,
      returnValue: analyzeReturnValue(name, instructions),
      raStores: readRaStores(name),
    };
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

  /* Operation recovery outranks compiler-state tuning: an inventory or frame
   * reading taken while the source hand-expands an SDK packet is a reading of
   * the wrong program, so the SDK finding is emitted first and, being a
   * signal, sorts above the inventory signal that would otherwise lead. */
  findings.push(...detectSdkIdioms(target, sourceState === "c" ? srcText : undefined));

  let frameConverged = false;
  if (sourceState === "c" && srcText !== undefined) {
    findings.push(...detectAsmPolicy(name, srcText));
    const compiled = readCompiled(name, resolveSource(name, srcOverride), scratch);
    if (compiled) {
      findings.push(...detectUndeclaredCallee(compiled));
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
  findings.push(...detectParamResidence(target));
  findings.push(...detectBackendPacket(target));
  findings.push(...detectLoopNesting(target));
  findings.push(...detectLoopIdiom(target));
  findings.push(...detectCaptureRa(target));
  findings.push(...detectFlagFingerprint(name, sourceState === "c" ? srcText : undefined));
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

/* Guarded so the detectors above can be imported by tests; an unguarded call
 * here runs the CLI on import and exits on the missing argument. */
if (import.meta.url === `file://${process.argv[1]}`) main();
