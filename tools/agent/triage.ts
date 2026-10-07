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
 *   boundary-premise  missing terminal abutting a zero-reloc return/padding
 *                   SDK placement: validate the extent before reconstructing C
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
 *   loop-preheader-order  a position-only residual in a loop preheader, which
 *                   loop.c's emission order owns and the scheduler does not
 *   phony-loop      a loop loop.c discarded unscanned, which voids every
 *                   movable/giv hypothesis inside it rather than refuting one
 *   cluster-donor   a recorded cluster-mate whose own loop trace reaches a
 *                   mechanism this program does not
 *   search-domain   a residual-source-search run that cannot support the
 *                   conclusion it looks like: an active rule whose axis is
 *                   empty or inert, or a class table that came from the cost
 *                   pilot rather than from evaluating the domain
 *
 * Usage:
 *   npx tsx tools/agent/triage.ts func_80016B7C
 *   npx tsx tools/agent/triage.ts func_80016B7C --json
 *   npx tsx tools/agent/triage.ts func_80016B7C --src /tmp/experiment.c
 */

import { existsSync, readFileSync, readdirSync, rmSync } from "fs";
import { join, resolve } from "path";
import { packetIsFresh } from "./prepareFunction.js";
import type { PreparationPacket } from "./campaign/packet.js";
import {
  ROOT,
  type DisassembledInstruction,
  assembleTarget,
  compileSource,
  containerForSymbol,
  detectImplicitDeclarations,
  disassembleObject,
  normalizeFunctionName,
  resolveAsmSource,
  resolveSource,
  sourcePathFor,
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
import { detectFunctionMacroIdentity } from "../diagnostics/macroIdentity.js";
import type { MacroFunctionReport } from "../diagnostics/macroTiler.js";
import { auditCallees, type TruthReport } from "./calleeTruth.js";
import { best, measurements, readLedger, type LedgerEntry } from "./experimentLedger.js";
import { readReport, targetHashOf, toolchainHash, type FlagProbeReport } from "./flagProbe.js";
import { sha256 } from "./variant-lab/artifacts.js";
import { projectPath } from "./provenance.js";
import { compareInventories, renderReport } from "./inventory.js";
import { BRANCH_MNEMONICS, defUse } from "./webAnalysis.js";
import { reversePipeline } from "./pipeline-reversal/reverse.js";
import type { MirProgram } from "./pipeline-reversal/types.js";
import { tokensAt } from "./idiom-corpus/normalize.js";
import { align } from "./idiom-corpus/align.js";
import { IdiomIndex, loadCorpus } from "./idiom-corpus/corpus.js";
import { fingerprintOf } from "./idiom-corpus/fingerprint.js";
import { targetProgram } from "./idiomSearch.js";
import { lineMapFor, loopTrace } from "./loopTrace.js";
import { preheaderLayouts } from "./loop-trace/preheader.js";
import { PHONY_CONSEQUENCE, phonyAntidote } from "./loop-trace/phony.js";
import { mechanismsOf, type Mechanism } from "./loop-trace/mechanisms.js";
import { quoteLine } from "./loop-trace/lines.js";
import type { LoopTrace } from "./loop-trace/types.js";
import { groupHeadingOf, siblingsOf } from "./fileGroupings.js";
import { targetLoopEmission } from "./analyzeTargetLoopEmission.js";
import { innerLoopsOf, loopBody, loopHeaders, preheaderOf } from "./loop-emission/derive.js";
import { goalsFor } from "./loop-emission/compare.js";
import { precedentIndex, precedentsFor } from "./loop-emission/precedents.js";
import { loadSubsegments } from "../lib/symbolIndex.js";
import { boundaryPremise, followingTextObject } from "../lib/sdkProvenance.js";
import { allocationDominant, fingerprintWebPartition, type FingerprintReport } from "../diagnostics/fingerprintWebPartition.js";
import { nestedFunctionCensus, chainRow, type ChainRow } from "../diagnostics/nestedFunctionScan.js";
import { sourceConstructFindings } from "../../.pi/extensions/shared/source-policy.ts";
import { loadConfig } from "../../.pi/extensions/shared/config.ts";

/* Both spellings: target assembly uses names, cc1 output uses numbers. */
const CALL_CLOBBERED = new Set([
  "v0", "v1", "a0", "a1", "a2", "a3",
  "t0", "t1", "t2", "t3", "t4", "t5", "t6", "t7", "t8", "t9",
  "2", "3", "4", "5", "6", "7", "8", "9", "10", "11",
  "12", "13", "14", "15", "24", "25",
]);

/** The fields `detectSearchDomain` reads out of a search run's artifacts. */
interface SearchGrammar {
  grammarSchemaVersion?: number;
  activeRules?: string[];
  partitionWebIds?: string[];
  webs?: unknown[];
  regions?: unknown[];
  caveats?: string[];
}

interface SearchSummary {
  status?: string;
  classes?: unknown[];
  classesSource?: { sampled: boolean; evaluatedCandidates: string; totalCandidates: string };
  axisEffects?: Array<{ id: string; radix: string; sampled: number; inert: boolean }>;
}

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

/* The container's own assembly, resolved by the toolchain module — the same
   answer the oracle and the assembler get, so a detector reading the target
   text and a measurement of that target never disagree about which file. */
function resolveTargetAsm(name: string): string | null {
  return resolveAsmSource(name);
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

function readCompiled(name: string, source: string, scratch: string, prepared?: string): CompiledFacts | null {
  let artifacts;
  try {
    if (prepared) {
      try {
        const packet = JSON.parse(readFileSync(join(ROOT, prepared), "utf8")) as PreparationPacket;
        if (packet.identity.functionName === name && packet.primary && resolve(ROOT, packet.primary.path) === resolve(source) &&
          packetIsFresh(packet) && packet.compilation.status === "succeeded" && packet.compilation.assembly && packet.compilation.preprocessed && packet.compilation.object) {
          artifacts = { assembly: join(ROOT, packet.compilation.assembly.path), preprocessed: join(ROOT, packet.compilation.preprocessed.path), object: join(ROOT, packet.compilation.object.path) };
          console.error("triage compilation: cache hit (fresh preparation input/output bundle)");
        }
      } catch { /* no usable receipt: perform the ordinary compile */ }
    }
    artifacts ??= compileSource(source, scratch, name, { assemble: true });
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
 * How many genuinely different programs may be measured without improving the
 * residual before the spelling family, rather than the residual, is the thing
 * that has been exhausted.
 *
 * Calibrated against a real stalled ledger rather than chosen: the session
 * that produced it ran seventeen distinct programs without a lexicographic
 * improvement while arguing that the residual was unreachable, and improved
 * steadily for the fifteen before that. Eight sits inside the stall and
 * outside the productive stretch. Respellings do not count toward it — a
 * source that compiles to a program already measured is the same experiment
 * arrived at again, and treating it as a failed one would fire this on a
 * session that is simply exploring.
 */
const DISTINCT_PROGRAMS_BEFORE_PREMISE_DOUBT = 8;

/** Lexicographic order over the staged residual: the worst term decides. */
function residualImproves(candidate: number[], incumbent: number[]): boolean {
  for (let index = 0; index < Math.max(candidate.length, incumbent.length); index++) {
    const difference = (candidate[index] ?? 0) - (incumbent[index] ?? 0);
    if (difference !== 0) return difference < 0;
  }
  return false;
}

/**
 * A residual that survives many different programs is evidence about the
 * premises, not about the residual.
 *
 * Every instrument in this repository takes the declarations, the operation
 * boundaries and the symbol boundary as the fixed background, and searches the
 * space of sources written against them. That makes a wrong premise invisible
 * to all of them at once: it is not a point in the space they search, it is
 * the space. Worse, it is self-confirming — each rewrite that fails to remove
 * what the premise manufactured reads as evidence that the residual is hard.
 *
 * The escape is not more variation. A session that fires a dozen genuinely
 * different spellings and moves nothing has not found a hard residual; it has
 * found that the answer is not a spelling. That is a positive result, and it
 * points somewhere specific — at the facts outside the function body, and at
 * the two records of what the original author actually wrote, which are the
 * vendored SDK headers and the already-matched functions in the same file
 * group. This detector exists to say so at the point the ledger can support
 * it, because an agent inside the wrong frame has no instrument that can
 * report the frame is wrong.
 */
export function detectPremiseSurvival(name: string): Finding[] {
  return premiseSurvivalFrom(readLedger(name));
}

/** The ledger reading, separated from the ledger, so it can be tested. */
export function premiseSurvivalFrom(entries: LedgerEntry[]): Finding[] {
  const distinct = measurements(entries);
  if (distinct.length === 0) return [];

  let best = distinct[0]!.key;
  let lastImprovement = 0;
  distinct.forEach((entry, index) => {
    if (index > 0 && residualImproves(entry.key, best)) {
      best = entry.key;
      lastImprovement = index;
    }
  });
  if (best.every((term) => term === 0)) return [];

  const since = distinct.length - 1 - lastImprovement;
  if (since < DISTINCT_PROGRAMS_BEFORE_PREMISE_DOUBT) return [];

  const [controlFlow = 0, population = 0, schedule = 0, allocation = 0] = best;
  const differs = controlFlow > 0
    ? "the two programs do not even have the same shape"
    : population > 0
      ? "the two programs still do not compute the same set of things"
      : "the two programs compute the same things, in a different order or different registers";

  return [{
    detector: "premise-survival",
    severity: "signal",
    summary:
      `${since} distinct programs have been measured since the residual last improved, and it is ` +
      `still [${controlFlow}, ${population}, ${schedule}, ${allocation}]. Respellings are excluded, ` +
      "so these were genuinely different programs and every one of them left the residual where it " +
      "was. That is not evidence that the residual is hard — it is evidence that the answer is not " +
      "a spelling, and the next place to look is the premises this source was written under.",
    evidence: [
      `best residual [control-flow ${controlFlow}, population ${population}, schedule ${schedule}, ` +
      `allocation ${allocation}] — ${differs}`,
      `${distinct.length} distinct programs in the ledger; the last ${since} moved nothing`,
      "",
      "what has not been audited, cheapest to refute first:",
      "  callee prototypes    — psx_callee_truth confronts every declaration in scope with the",
      "                         vendored SDK headers and the callees' own compiled code. A wrong",
      "                         one adds call setup no rewrite of this body can remove.",
      "  operation boundaries — psx_sdk_idioms. Hand-rolled arithmetic where the SDK has a macro",
      "                         computes the right value as the wrong program.",
      "  the symbol boundary  — psx_scan_read_before_def, and the evidence list in the stuck sheet.",
      "  the authoring idiom  — the matched functions in this target's file group are this",
      "                         project's only record of how the original author wrote things:",
      "                         which locals they kept, how they walked arrays, what they hoisted.",
      "                         notes/file-groupings.md names the group; read the members.",
    ],
    see: ["prompts/reference/stuck.md", "notes/file-groupings.md"],
  }];
}

/**
 * Confront the declarations with the evidence, before anything reads the
 * residual they produce.
 *
 * Every other detector here — and every tool the skill escalates to — takes
 * the prototypes as the fixed background against which the source varies. A
 * wrong prototype is therefore not something they can find: it is not a point
 * in the space they search, it is the space. It manufactures call-setup moves
 * and a return handling the target never had, and each experiment that fails
 * to remove them reads as evidence that the residual is hard rather than as
 * evidence that the premise is false.
 *
 * This runs before the residual is classified because a measurement taken
 * under a contradicted declaration is a measurement of a different program.
 */

/**
 * The function's own answer to its own question.
 *
 * The strongest signal available in `ovl_10_func_800BB264` was that two
 * structurally identical loops in one file had different residuals: case 1's
 * second loop indexed the global array directly and matched, while the first
 * walked a hoisted base pointer and did not. The counter-example was eleven
 * lines away in the same file, and no instrument looked for it. The loop spent
 * thirty-four minutes and was parked.
 *
 * So: partition the blocks by residual state, and for every open block look for
 * a *closed* block whose target instruction shapes are the same sequence. Where
 * one exists, the source that produced the closed block is a proven spelling
 * for that shape in this exact translation unit — same compiler invocation,
 * same author, same file. Nothing else this project can offer is that specific.
 *
 * Shapes, not text: two loops over different arrays have different operands and
 * the same shape, which is the whole point. A minimum length keeps a two-word
 * epilogue from matching every other two-word epilogue in the function.
 */
const SELF_SIMILARITY_MIN_SHAPES = 4;
/**
 * How much of the shape sequence has to align for two blocks to be the same
 * code written twice.
 *
 * Not equality. The two render loops in `ovl_10_func_800BB264` differ by one
 * instruction — the second carries a `+0x20` the first does not — and the two
 * loop bodies differ by one more. Requiring an identical sequence rejects
 * exactly the pairs this detector exists to find. Requiring most of it, in
 * order, accepts them and still rejects two unrelated four-instruction blocks
 * that happen to share a `lui`/`lw` opening.
 */
const SELF_SIMILARITY_MIN_RATIO = 0.7;

/**
 * A block's instruction shapes, at the tier that makes two instances of one
 * idiom compare equal.
 *
 * `MirInsn.shape` is the wrong key here on both counts: it masks every register
 * to `<reg>`, losing the callee-saved-versus-scratch distinction that is often
 * the whole residual, and it keeps every immediate literally, so the same loop
 * over two different globals — `addiu <reg>,<reg>,-17844` against
 * `addiu <reg>,<reg>,-18324` — reads as two different shapes and never
 * matches. The corpus normalizer keeps the register class and buckets the
 * immediate, which is exactly the pair of decisions this comparison needs.
 */
function blockShapes(program: MirProgram, block: number): string[] {
  return tokensAt(program.insns.filter((insn) => insn.block === block), 0);
}

function blockVram(program: MirProgram, block: number): number | undefined {
  return program.insns.find((insn) => insn.block === block)?.vram;
}

export /**
 * The already-matched function whose original code looks like this one's.
 *
 * The cold-start half of the idiom corpus, run without being asked. Two of the
 * four functions the overnight loop parked were closed by an idiom that was
 * already proven in the tree — `ovl_10_func_800B9D24`, matched three hours
 * earlier in the same directory, walks its array as `D_800BB99C[s0 + 1]` —
 * and nothing surfaced it. The doctrine already told the agent to read its
 * matched neighbours; this is the instrument that names which ones.
 *
 * Emitted for a stub as readily as for a draft: the query is the *target's*
 * assembly, so it needs no C at all, which is exactly when it is worth most.
 * Nothing is compiled — the corpus is lifted from the original bytes and
 * cached, so a warm run is a few tens of milliseconds.
 */
const IDIOM_MIN_ALIGNED = 8;
const IDIOM_MIN_REGION_RATIO = 0.6;

export function detectIdiomPrecedent(name: string): Finding[] {
  const program = targetProgram(name);
  if (!program || program.insns.length < IDIOM_MIN_ALIGNED) return [];
  let hits;
  try {
    const corpus = loadCorpus(targetProgram, { tier: 0, exclude: [name] });
    if (corpus.included.length === 0) return [];
    hits = new IdiomIndex(corpus).search(tokensAt(program.insns, 0), {
      excludeFunction: name,
      limit: 6,
      queryFingerprint: fingerprintOf(name),
    });
  } catch {
    return [];
  }

  /* A hit is worth reporting when it explains a real run of this function's
     shapes and most of its own — a long query will always share a prologue
     with something. */
  const worthwhile = hits.filter(
    (hit) => hit.common >= IDIOM_MIN_ALIGNED && hit.ratio >= IDIOM_MIN_REGION_RATIO,
  );
  if (worthwhile.length === 0) return [];

  const seen = new Set<string>();
  const evidence: string[] = [];
  for (const hit of worthwhile) {
    if (seen.has(hit.region.functionName)) continue;
    seen.add(hit.region.functionName);
    const where = hit.region.vram === undefined ? "" : ` at 0x${hit.region.vram.toString(16).toUpperCase()}`;
    evidence.push(
      `${hit.region.functionName} ${hit.region.kind} ${hit.region.block}${where} — ` +
      `${hit.common} of its ${hit.region.tokens.length} shapes align in order (${hit.distance} toolchain)`,
    );
    if (seen.size >= 3) break;
  }
  evidence.push(
    "These are already byte-exact. Read how they spell this shape before writing your own —",
    "a proven idiom from this author beats any model of the compiler.",
    `psx_idiom_search ${name} --source prints the top hit's C; add --block N once you have a residual.`,
  );

  return [{
    detector: "idiom-precedent",
    severity: "signal",
    summary:
      `${seen.size} already-matched function(s) contain runs of the same instruction shapes as this target. ` +
      "Their C is a proven spelling for this shape in this codebase.",
    evidence,
    see: ["psx_idiom_search", "notes/file-groupings.md"],
  }];
}

function detectSelfSimilarity(name: string, sourcePath: string): Finding[] {
  let artifacts: ReturnType<typeof reversePipeline>;
  try {
    artifacts = reversePipeline({ functionName: name, source: sourcePath, replay: false });
  } catch {
    /* A stub, a compile error, or a function the reversal cannot lift. Every
       one of those is another detector's finding, not this one's. */
    return [];
  }
  const objective = artifacts.report.objective;
  if (objective.exact) return [];

  const target = artifacts.target.preDbr;
  const open = objective.blocks.filter((block) => block.total > 0 && !block.blind);
  const closed = objective.blocks.filter((block) => block.total === 0);
  if (open.length === 0 || closed.length === 0) return [];

  const closedShapes = closed
    .map((block) => ({ block: block.block, shapes: blockShapes(target, block.block) }))
    .filter((item) => item.shapes.length >= SELF_SIMILARITY_MIN_SHAPES);
  if (closedShapes.length === 0) return [];

  const findings: Finding[] = [];
  for (const block of open) {
    const shapes = blockShapes(target, block.block);
    if (shapes.length < SELF_SIMILARITY_MIN_SHAPES) continue;
    const twin = closedShapes
      .map((item) => ({ ...item, alignment: align(shapes, item.shapes) }))
      /* Both conditions. The ratio alone lets a four-instruction block qualify
         on three aligned words, which is every prologue in the binary; the
         absolute count alone lets a long block qualify on a short shared run. */
      .filter((item) => item.alignment.ratio >= SELF_SIMILARITY_MIN_RATIO &&
        item.alignment.common >= SELF_SIMILARITY_MIN_SHAPES)
      .sort((left, right) => right.alignment.ratio - left.alignment.ratio)[0];
    if (!twin) continue;
    const here = blockVram(target, block.block);
    const there = blockVram(target, twin.block);
    const identical = twin.alignment.ratio === 1;
    findings.push({
      detector: "self-similarity",
      severity: "signal",
      summary:
        `Block ${block.block} is open (population ${block.population}, schedule ${block.schedule}, ` +
        `allocation ${block.allocation + block.coalescing}); block ${twin.block} is closed and ` +
        `${identical ? "has the same target instruction shapes" : `aligns with it on ${twin.alignment.common} of ${Math.max(shapes.length, twin.shapes.length)} shapes`}. ` +
        "The same code shape is already being produced correctly elsewhere in this function.",
      evidence: [
        `open   block ${block.block}${here === undefined ? "" : ` at 0x${here.toString(16).toUpperCase()}`} — ${shapes.join(" | ")}`,
        `closed block ${twin.block}${there === undefined ? "" : ` at 0x${there.toString(16).toUpperCase()}`} — ${twin.shapes.join(" | ")}`,
        "Find the two source regions that produced these and make the open one read like the closed one.",
        "They differ in spelling, not in what they compute — that is what the aligned shapes mean.",
        "This is the strongest evidence available: same compiler invocation, same file, same author.",
      ],
      see: ["psx_residual_objective", "psx_reverse_pipeline"],
    });
  }
  return findings.slice(0, 3);
}

/**
 * The residual is *where* an instruction sits in a loop preheader.
 *
 * A preheader's contents are not laid out by the scheduler. `move_movables`
 * and `strength_reduce` both emit with `emit_insn_before (..., loop_start)`,
 * so each emission lands immediately before the loop and the preheader ends up
 * as the source's own code, then the movables in the order the pass moved
 * them, then the giv initialisations — per pass, and the pass runs twice at
 * -O2. Two programs with the same preheader instructions in a different order
 * therefore differ in a loop.c decision, not in a scheduling one, and the
 * levers are the ones move_movables compares: `savings`, which starts at
 * n_times_set[regno] and absorbs every movable that matches or forces it, and
 * `lifetime`, the luid span of the register inside the loop.
 *
 * This detector exists because that was invisible. Two sessions on
 * ovl_10_func_800BA394 read the preheader off the assembly, reasoned about
 * loop.c from its source, and reached a wrong conclusion — one of them an
 * impossibility proof — while `-dL` was available the whole time and prints
 * every one of the decisions.
 */
function detectLoopPreheaderOrder(name: string, sourcePath: string): Finding[] {
  let artifacts: ReturnType<typeof reversePipeline>;
  try {
    artifacts = reversePipeline({ functionName: name, source: sourcePath, replay: false });
  } catch {
    return [];
  }
  const objective = artifacts.report.objective;
  if (objective.exact) return [];

  const target = artifacts.target.preDbr;
  /* A block reached by a later block is a loop header; the earlier block that
     reaches it is its preheader. */
  const headers = new Set<number>();
  for (const block of target.blocks) {
    if (block.predecessors.some((predecessor) => predecessor >= block.index)) headers.add(block.index);
  }
  const preheaders = new Map<number, number[]>();
  for (const header of headers) {
    for (const predecessor of target.blocks[header]?.predecessors ?? []) {
      if (predecessor < header) preheaders.set(predecessor, [...(preheaders.get(predecessor) ?? []), header]);
    }
  }

  /* Position, not population: both programs contain the instruction. An
     allocation term alongside it is expected rather than a second problem —
     moving a materialisation past another one rotates which register each
     lands in. */
  const suspects = objective.blocks.filter((block) =>
    !block.blind && block.schedule > 0 && block.population === 0 && preheaders.has(block.block));
  if (suspects.length === 0) return [];

  /* The requirement comes off the target's bytes, so it stands even when the
     candidate cannot be traced. */
  let goals: ReturnType<typeof goalsFor> = [];
  let precedentLines: string[] = [];
  try {
    const requirement = targetLoopEmission(name);
    goals = requirement.preheaders.flatMap((preheader) => goalsFor(preheader));
    if (goals.length > 0) {
      /* Built here rather than left for the reader to think of asking. Five
         sessions ran on this residual class without anyone querying the corpus
         on the one key that finds a worked example. */
      const index = precedentIndex();
      const hits = requirement.preheaders
        .flatMap((preheader) => precedentsFor(preheader, index.value))
        .filter((hit) => hit.precedent.functionName !== name)
        .sort((left, right) => right.score - left.score);
      precedentLines = hits.length === 0
        ? [`PRECEDENT: none — of ${index.value.scanned} matched functions, none forces an emission past ` +
           "pass 1. There is no worked example to copy; you are deriving a spelling, not recalling one."]
        : ["PRECEDENT — matched functions that already emit past pass 1. READ THEIR C; they match no",
           "cluster, file or name here, and nothing but this key finds them:",
           ...hits.slice(0, 3).map((hit) => `  ${hit.precedent.functionName} — ${hit.precedent.source} (${hit.why})`)];
    }
  } catch {
    /* No liftable target is another detector's finding, not this one's. */
  }

  let layouts: ReturnType<typeof preheaderLayouts> = [];
  let traceNote = "";
  try {
    layouts = preheaderLayouts(loopTrace(name, sourcePath).result.trace);
  } catch (error) {
    traceNote = `psx_loop_trace could not compile this source with -dL: ${(error as Error).message}`;
  }

  return suspects.map((block) => {
    const vram = blockVram(target, block.block);
    const evidence: string[] = [
      `block ${block.block}${vram === undefined ? "" : ` at 0x${vram.toString(16).toUpperCase()}`} is the preheader of loop header ` +
      `${preheaders.get(block.block)!.join(", ")}: schedule ${block.schedule}, population ${block.population}` +
      `${block.allocation + block.coalescing > 0 ? `, allocation ${block.allocation + block.coalescing} (downstream of the position, not a second defect)` : ""}`,
    ];
    if (traceNote) evidence.push(traceNote);
    for (const layout of layouts) {
      evidence.push(`loop ${layout.from}..${layout.to}, pass ${layout.pass} emitted into its preheader, in order:`);
      for (const slot of layout.slots) {
        evidence.push(`  ${slot.uid === undefined ? "  ?" : String(slot.uid).padStart(5)}  ${slot.detail}`);
      }
    }
    for (const goal of goals) {
      evidence.push(
        `REQUIRED of the original: ${goal.symbol} cannot have been emitted in pass 1` +
        `${goal.unconditional ? "" : " (in any reading where anything earlier was hoisted)"}.`);
    }
    evidence.push(...precedentLines);
    evidence.push("The emission order is the decision. psx_target_loop_emission states it as a goal");
    evidence.push("and scores a candidate on it; psx_loop_trace shows each movable's savings x lifetime");
    evidence.push("against the threshold it was compared to. Iterate on that distance, NOT the byte");
    evidence.push("score — it is flat across this whole family and ranks the mechanism-correct");
    evidence.push("variant worst. A pass-2 hoist lands AFTER pass 1's giv initialisations, which is a");
    evidence.push("preheader order no pass-1 movable can produce.");
    return {
      detector: "loop-preheader-order",
      severity: "signal" as const,
      summary:
        `Block ${block.block} carries the same instructions as the target in a different order, and it is a ` +
        "loop preheader. Preheader position is decided by loop.c's emission order — movables in move " +
        "order, then giv inits, per pass — not by the scheduler, so scheduler and allocator forensics " +
        "will not reach it. Read the loop pass's own log.",
      evidence,
      see: ["psx_target_loop_emission", "psx_loop_trace", "prompts/reference/loop.md"],
    };
  }).slice(0, 3);
}

/**
 * A loop the pass never scanned, and what that voids.
 *
 * `loop.c` prints one line for this — `Loop from A to B is phony.` — and
 * returns before recording a single movable, biv or giv. Everything the trace
 * then does *not* say about that loop is an absence, and a reader who takes it
 * for a decision has inverted the evidence: "no movable was recorded" reads as
 * "nothing was worth hoisting" when it means "nothing was ever asked".
 *
 * The expensive case is a phony INNER loop, because it is silent and it is
 * self-confirming. Every per-iteration placement the source intended for that
 * loop happens at the enclosing loop instead — which is often a regime an
 * earlier session already refuted — so the experiment comes back agreeing with
 * the refutation. Two variants of one function failed exactly this way while
 * the line sat unread in the trace.
 */
function detectPhonyLoop(name: string, sourcePath: string): Finding[] {
  let traced: ReturnType<typeof loopTrace>;
  try {
    traced = loopTrace(name, sourcePath);
  } catch {
    /* No traceable source is another detector's finding, not this one's. */
    return [];
  }
  return phonyFindingsFrom(traced.result.trace, projectPath(sourcePath), residualNest(name, sourcePath));
}

/**
 * Where the residual is, in the loop structure.
 *
 * The phony finding is about per-iteration placement, so it is worth a blocker
 * exactly when the residual is somewhere placement decides. A block inside a
 * loop nest, or the preheader of one, is that place; a residual in straight-line
 * code three hundred instructions away is not, however phony the loop is.
 */
interface ResidualNest {
  /** Open blocks that sit in, or feed, a loop that nests another. */
  blocks: number[];
  /** How the blocks relate to the nest, for the evidence. */
  detail: string[];
}

function residualNest(name: string, sourcePath: string): ResidualNest | undefined {
  let artifacts: ReturnType<typeof reversePipeline>;
  try {
    artifacts = reversePipeline({ functionName: name, source: sourcePath, replay: false });
  } catch {
    return undefined;
  }
  const objective = artifacts.report.objective;
  if (objective.exact) return { blocks: [], detail: [] };

  const target = artifacts.target.preDbr;
  const nests = new Map<number, number[]>();
  for (const header of loopHeaders(target)) {
    const inner = innerLoopsOf(target, header);
    if (inner.length > 0) nests.set(header, inner);
  }
  if (nests.size === 0) return { blocks: [], detail: [] };

  const open = objective.blocks.filter((block) => !block.blind && block.total > 0
    && block.population + block.schedule + block.allocation + block.coalescing > 0);

  const blocks: number[] = [];
  const detail: string[] = [];
  for (const block of open) {
    for (const [header, inner] of nests) {
      const body = loopBody(target, header);
      const last = body[body.length - 1]?.index ?? header;
      const inside = block.block >= header && block.block <= last;
      const feeds = preheaderOf(target, header) === block.block;
      if (!inside && !feeds) continue;
      blocks.push(block.block);
      detail.push(
        `block ${block.block} (population ${block.population}, schedule ${block.schedule}, ` +
        `allocation ${block.allocation + block.coalescing}) ${inside ? "is inside" : "is the preheader of"} ` +
        `loop header ${header}, which nests loop header ${inner.join(", ")}`);
      break;
    }
  }
  return { blocks, detail };
}

/**
 * The trace reading, separated from the compile, so it can be tested.
 *
 * `nest` is the residual's own position. Passing `undefined` means it could not
 * be read — the reversal did not run — and the finding is then made on the
 * trace alone rather than withheld, because a phony loop with an unknown
 * residual is still a fact about a program nobody should reason about.
 */
export function phonyFindingsFrom(trace: LoopTrace, source: string, nest?: ResidualNest): Finding[] {
  const phony = trace.passes
    .flatMap((pass) => pass.loops.map((loop) => ({ pass: pass.index, loop })))
    .filter((entry) => entry.loop.phony);
  if (phony.length === 0) return [];
  /* An exact program, or a residual that is nowhere placement decides, is not
     this finding's business: the discarded loop is real either way, but nothing
     the reader is about to reason about turns on it. */
  if (nest !== undefined && nest.blocks.length === 0) return [];

  /* Report each discarded range once: a loop phony in pass 1 is phony in pass 2
     for the same reason, and printing both reads as two defects. */
  const seen = new Set<string>();
  const distinct = phony.filter((entry) => {
    const key = `${entry.loop.from}..${entry.loop.to}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const scanned = trace.passes
    .flatMap((pass) => pass.loops)
    .filter((loop) => !loop.phony);

  const evidence: string[] = [];
  if (nest !== undefined) {
    evidence.push("the residual is where placement decides it, which is why this is a blocker and not a note:");
    for (const line of nest.detail.slice(0, 4)) evidence.push(`  ${line}`);
    if (nest.detail.length > 4) {
      evidence.push(`  ...and ${nest.detail.length - 4} more open block(s) in the same nest`);
    }
  } else {
    evidence.push(
      "the residual's own position could not be read (the pipeline reversal did not run), so this is " +
      "reported on the trace alone: the program contains a loop the pass never scanned.");
  }
  for (const entry of distinct) {
    const { loop } = entry;
    const enclosing = scanned.filter((other) =>
      other.from <= loop.from && loop.to <= other.to && !(other.from === loop.from && other.to === loop.to));
    evidence.push(`loop ${loop.from}..${loop.to} — discarded unscanned, first seen in pass ${entry.pass}`);
    if (loop.phonyCause) {
      evidence.push(`  cause: ${loop.phonyCause.detail}`);
      if (loop.phonyCause.symbols?.length) {
        evidence.push(`  those insns materialise ${loop.phonyCause.symbols.join(", ")}`);
      }
    }
    if (enclosing.length > 0) {
      const ranges = [...new Set(enclosing.map((other) => `${other.from}..${other.to}`))];
      evidence.push(
        `  it is NESTED inside scanned loop ${ranges.join(", ")}. Every placement this loop was meant ` +
        "to carry per-iteration happens at that enclosing loop instead — a different regime, and one " +
        "you may already have refuted.");
    }
    for (const line of phonyAntidote(loop.phonyCause)) evidence.push(`  ${line}`);
  }
  evidence.push(...PHONY_CONSEQUENCE);
  evidence.push(
    `traced from ${source}; psx_loop_trace prints the same record with every ` +
    "decision the scanned loops did make.");

  return [{
    detector: "phony-loop",
    severity: "blocker",
    summary:
      `loop.c discarded ${distinct.length} loop${distinct.length === 1 ? "" : "s"} in this program without ` +
      "scanning it. No movable, biv or giv was recorded there, so every hypothesis about what is hoisted " +
      "or reduced inside it is void — not refuted, unasked. Fix the loop's entry shape before measuring " +
      "anything that depends on per-iteration placement.",
    evidence,
    see: ["psx_loop_trace", "prompts/reference/loop.md"],
  }];
}

/* --- cluster donors --- */

/**
 * Siblings traced per run.
 *
 * The natural bound is the group: a recorded cluster is the population whose
 * evidence transfers, and stopping short of it would drop members for no
 * reason a reader could act on. The ceiling exists only so a mis-edited note
 * cannot turn one triage run into hundreds of compiles — and a `-dL` compile of
 * one of these functions measures in tens of milliseconds, so covering a whole
 * cluster costs about a second on a cold cache and nothing after.
 */
const MAX_DONORS = 24;

/**
 * Programs of the target itself traced for the "and this one has not" half.
 *
 * One per distinct residual key, best first: two programs on one key are one
 * point in the search and tracing both buys nothing. The bound is what keeps a
 * function with a two-hundred-row ledger from turning triage into a build, and
 * what it drops is reported rather than implied.
 */
const MAX_OWN_VARIANTS = 8;

/** The C a function's loop pass can actually be run on, and what it is. */
function traceableSource(name: string): { path: string; how: string } | undefined {
  const own = sourcePathFor(name);
  if (existsSync(own) && !/INCLUDE_ASM/.test(readFileSync(own, "utf-8"))) {
    return { path: own, how: "its matched source" };
  }
  const winner = best(readLedger(name));
  if (!winner?.sourcePath) return undefined;
  const preserved = join(ROOT, winner.sourcePath);
  if (!existsSync(preserved)) return undefined;
  return { path: preserved, how: `its preserved best attempt, key [${winner.key.join(",")}]` };
}

function mechanismsFor(
  name: string,
): { mechanisms: Mechanism[]; how: string; path: string } | { error: string } {
  const source = traceableSource(name);
  if (!source) return { error: "no matched source and no preserved attempt — nothing to run its loop pass on" };
  try {
    return {
      mechanisms: mechanismsOf(loopTrace(name, source.path).result.trace),
      how: source.how,
      path: projectPath(source.path),
    };
  } catch (error) {
    /* `feedback_tools_correct_over_convenient`: a sibling whose attempt no
       longer compiles is undetermined, and saying so is the finding. Silently
       dropping it would report the cluster as surveyed. */
    return { error: `${source.how} no longer traces: ${(error as Error).message}` };
  }
}

/**
 * Every mechanism any of this function's own measured programs has reached.
 *
 * The finding's claim is "and no program of yours has ever reached it", which
 * one trace cannot support: the current source is one point, and a session that
 * has run sixty of them has sixty. The ledger preserves each measured source
 * content-addressed, so the rest cost one compile each — best row per distinct
 * key, because two spellings on one key are the same program twice.
 */
function ownMechanisms(name: string): {
  ids: Set<string>;
  mechanisms: Mechanism[];
  traced: string[];
  dropped: number;
  /** Distinct keys whose program predates the ledger preserving its sources. */
  unpreserved: number;
  errors: string[];
} {
  const ids = new Set<string>();
  const mechanisms: Mechanism[] = [];
  const traced: string[] = [];
  const errors: string[] = [];

  const absorb = (found: Mechanism[]): void => {
    for (const mechanism of found) {
      if (ids.has(mechanism.id)) continue;
      ids.add(mechanism.id);
      mechanisms.push(mechanism);
    }
  };

  const current = mechanismsFor(name);
  if ("error" in current) errors.push(current.error);
  else { absorb(current.mechanisms); traced.push(current.how); }

  /* The ledger's distinct keys, best first. `best` is reused per group so an
     unproven zero never outranks a real key inside one. */
  const byKey = new Map<string, LedgerEntry[]>();
  for (const entry of measurements(readLedger(name))) {
    const key = entry.key.join(",");
    byKey.set(key, [...(byKey.get(key) ?? []), entry]);
  }
  const bests = [...byKey.values()].map((group) => best(group));
  /* Rows written before the ledger preserved its sources carry no path, so
     their programs cannot be re-traced at all. That is a real hole in the
     "no program of yours ever reached it" claim and is reported as one. */
  const unpreserved = bests.filter((entry) => entry !== undefined && entry.sourcePath === undefined).length;
  const winners = bests
    .filter((entry): entry is LedgerEntry => entry !== undefined && entry.sourcePath !== undefined)
    .sort((left, right) => {
      for (let index = 0; index < Math.max(left.key.length, right.key.length); index++) {
        const difference = (left.key[index] ?? 0) - (right.key[index] ?? 0);
        if (difference !== 0) return difference;
      }
      return 0;
    });

  const considered = winners.slice(0, MAX_OWN_VARIANTS);
  for (const entry of considered) {
    const path = join(ROOT, entry.sourcePath!);
    if (!existsSync(path)) { errors.push(`${entry.sourcePath} is no longer on disk`); continue; }
    try {
      /* Its own artifact slot: tracing these under the function's own key would
         overwrite the trace every other reader of this function expects. */
      absorb(mechanismsOf(loopTrace(name, path, entry.sourceHash.slice(0, 16)).result.trace));
      traced.push(`[${entry.key.join(",")}] ${projectPath(path)}`);
    } catch (error) {
      errors.push(`[${entry.key.join(",")}] no longer traces: ${(error as Error).message}`);
    }
  }

  return { ids, mechanisms, traced, dropped: winners.length - considered.length, unpreserved, errors };
}

/**
 * What the target's own bytes require of the loop pass, scoped to where the
 * residual actually is.
 *
 * Two readings, and the narrower one is used when it can be. The requirement
 * derived from the bytes covers every preheader in the function; the residual
 * says which of them is still open, and a goal in a preheader that already
 * matches is not a reason to go looking for a donor. When there is no candidate
 * to take a residual from — a parked function's file is a stub, which is
 * exactly the state this detector is most worth something in — the whole
 * function's goals stand, and the scope line says so.
 */
function loopRequirementOf(
  name: string,
  sourcePath?: string,
): { goals: ReturnType<typeof goalsFor>; scope: string } {
  let requirement: ReturnType<typeof targetLoopEmission>;
  try {
    requirement = targetLoopEmission(name);
  } catch {
    /* No liftable target is another detector's finding. */
    return { goals: [], scope: "the target could not be lifted, so no loop-emission requirement was read" };
  }

  if (sourcePath !== undefined) {
    try {
      const objective = reversePipeline({ functionName: name, source: sourcePath, replay: false }).report.objective;
      if (objective.exact) {
        return { goals: [], scope: "this program is byte-exact; there is no residual to find a donor for" };
      }
      const open = new Set(objective.blocks
        .filter((block) => !block.blind
          && block.population + block.schedule + block.allocation + block.coalescing > 0)
        .map((block) => block.block));
      const here = requirement.preheaders.filter((preheader) =>
        open.has(preheader.block) || open.has(preheader.header));
      if (here.length > 0) {
        return {
          goals: here.flatMap((preheader) => goalsFor(preheader)),
          scope: `scoped to the ${here.length} preheader(s) the residual is still open at: block ` +
            `${here.map((preheader) => preheader.block).join(", ")}`,
        };
      }
      return {
        goals: [],
        scope: "no preheader of this function carries an open residual, so the loop pass is not what is " +
          "left to fix here",
      };
    } catch {
      /* Fall through to the whole-function requirement. */
    }
  }

  return {
    goals: requirement.preheaders.flatMap((preheader) => goalsFor(preheader)),
    scope: "read over the whole function: there is no candidate to take a residual from, so no preheader " +
      "could be ruled out",
  };
}

/**
 * The measured mechanisms of this function's cluster-mates.
 *
 * The relation this reads — `notes/file-groupings.md` — is already used to
 * suggest neighbours to *read*. This asks a different question of it, and one
 * nothing else in the stack asks: not "how did the author spell things" but
 * "which compiler mechanisms are provably reachable in this cluster, and by
 * which of us". A sibling's preserved attempt is author-side evidence even when
 * the attempt failed: its trace is a measurement, and one compile buys it.
 *
 * The case this exists for is not hypothetical. Two functions of one cluster
 * sat parked for weeks as complementary halves — each one's trace demonstrated,
 * measured, the mechanism the other was missing — and both sessions read the
 * sibling only as something a future fix would also close, never as a source of
 * evidence. Nothing in triage looked sideways.
 *
 * The sharpest form is a contradiction rather than an absence: a giv shape the
 * sibling REDUCED and this program's own trace was REFUSED. Both programs put
 * the same question to the same pass and got different answers, so the
 * difference is in the source, and the log prints both sides of the inequality.
 */
function detectClusterDonor(name: string, sourcePath?: string): Finding[] {
  const siblings = siblingsOf(name);
  if (siblings.length === 0) return [];

  const mine = ownMechanisms(name);
  const own = mine.mechanisms;
  const ownIds = mine.ids;

  const { goals, scope } = loopRequirementOf(name, sourcePath);

  const considered = siblings.slice(0, MAX_DONORS);
  const dropped = siblings.slice(MAX_DONORS);
  const undetermined: string[] = [];
  const donors: string[] = [];
  const evidence: string[] = [];

  for (const sibling of considered) {
    const theirs = mechanismsFor(sibling);
    if ("error" in theirs) { undetermined.push(`${sibling}: ${theirs.error}`); continue; }

    /* The strongest form: the same question, put to the same pass, answered
       differently. Both programs offered a giv of this shape; one was reduced
       and one refused, so the difference is in the source and the log prints
       both sides of the inequality that decided it. */
    const contradictions = theirs.mechanisms.filter((mechanism) =>
      mechanism.id.startsWith("giv-reduced:")
      && ownIds.has(`giv-declined:${mechanism.id.slice("giv-reduced:".length)}`));

    /* The weaker form, and gated on the requirement so it stays evidence rather
       than trivia: a mechanism that produces a pass-2 emission, reached there
       and not here, when this target's own bytes force a pass-2 emission. */
    const absences = goals.length === 0
      ? []
      : theirs.mechanisms.filter((mechanism) =>
        (mechanism.id === "cascade" || mechanism.id === "pass2-movable") && !ownIds.has(mechanism.id));

    if (contradictions.length === 0 && absences.length === 0) continue;
    donors.push(sibling);

    /* The lines of C the mechanism is about. `loop.c` logs UIDs and a UID sends
       a reader to the whole function; the statement that produced it sends them
       to the edit. Costs two compiles of the sibling and is skipped silently
       when the two disagree about anything, because a wrong line is worse than
       no line. */
    const lines = lineMapFor(sibling, theirs.path);
    const quote = (mechanism: Mechanism, indent: string): void => {
      if (!lines) return;
      const seen = new Set<string>();
      for (const uid of mechanism.insns) {
        /* `lines.file` is the path the compiler itself recorded in the note,
           which is right whether the source is in the tree or preserved outside
           it; re-deriving it from a project-relative path would not be. */
        const text = quoteLine(lines, lines.file, uid);
        if (text === undefined || seen.has(text)) continue;
        seen.add(text);
        evidence.push(`${indent}${theirs.path} ${text}`);
      }
    };

    evidence.push(`${sibling} — ${theirs.how}; its loop pass was run and this is what it reached.`);
    for (const mechanism of contradictions) {
      const shape = mechanism.id.slice("giv-reduced:".length);
      const refused = own.find((entry) => entry.id === `giv-declined:${shape}`)!;
      evidence.push(`  SAME QUESTION, DIFFERENT ANSWER — giv shape ${shape}`);
      evidence.push(`    there: ${mechanism.witness}`);
      evidence.push(`    here:  ${refused.witness}`);
      evidence.push(`    ${mechanism.label}`);
      evidence.push("    THE SOURCE THAT PRODUCES IT:");
      quote(mechanism, "      ");
      /* Scoped to this shape, not to the program. Whether the donor combines
         givs *somewhere* is nearly always yes and says nothing; whether the giv
         of the shape yours was refused reached the gate by summing two
         occurrences is the edit. */
      if (mechanism.combined) {
        evidence.push(
          "    and it got there by COMBINING: identical givs have their benefits summed, so an " +
          "expression that declines as one occurrence can clear the gate as two. Spelling the same " +
          "expression at a second consumer is the lever, not a redundancy.");
        const combine = theirs.mechanisms.find((entry) => entry.id === "giv-combined");
        if (combine) evidence.push(`    ${combine.witness}`);
      }
    }
    for (const mechanism of absences) {
      evidence.push(`  REACHED THERE, NOT HERE — ${mechanism.id}`);
      evidence.push(`    ${mechanism.label}`);
      evidence.push(`    ${mechanism.witness}`);
      evidence.push("    THE SOURCE THAT PRODUCES IT:");
      quote(mechanism, "      ");
    }
    if (!lines) {
      evidence.push(
        `  no source-line attribution for ${theirs.path} — its -g and plain compiles do not agree ` +
        "instruction for instruction, so no line is quoted rather than a wrong one. Read the file.");
    } else {
      evidence.push(`  read ${theirs.path} around those lines for the spelling that produces it.`);
    }
  }

  if (donors.length === 0) return [];

  if (goals.length > 0) {
    evidence.push(
      "",
      `this target's own requirement forces ${goals.map((goal) => goal.symbol).join(", ")} past pass 1, so a ` +
      "mechanism that produces a pass-2 emission is on the path here too; psx_target_loop_emission names " +
      "the routes and psx_loop_trace measures which one your program takes.");
  }

  /* What the survey did not cover, stated rather than implied. A cap that is
     silent reads afterwards as "the cluster was searched". */
  evidence.push(
    "",
    `cluster: ${groupHeadingOf(name) ?? "(unnamed group)"} — ${siblings.length} sibling(s) recorded, ` +
    `${considered.length} traced.`,
    `requirement: ${scope}.`,
    mine.traced.length === 0
      ? "this program's own side is UNDETERMINED — nothing of it could be traced. Everything above is " +
        "what the siblings reach, with nothing to compare it against."
      : `this program's own side is the union over ${mine.traced.length} of its own measured program(s): ` +
        `${mine.traced.join("; ")}.`);
  if (mine.dropped > 0) {
    evidence.push(`its own programs not traced (cap ${MAX_OWN_VARIANTS} distinct keys): ${mine.dropped}.`);
  }
  if (mine.unpreserved > 0) {
    evidence.push(
      `${mine.unpreserved} of its distinct keys predate the ledger preserving its sources, so those ` +
      "programs cannot be re-traced and are NOT part of the comparison above.");
  }
  for (const error of mine.errors) evidence.push(`its own side, undetermined: ${error}.`);
  if (dropped.length > 0) evidence.push(`not traced (cap ${MAX_DONORS}): ${dropped.join(", ")}.`);
  if (undetermined.length > 0) evidence.push(`undetermined: ${undetermined.join("; ")}.`);

  return [{
    detector: "cluster-donor",
    severity: "signal",
    summary:
      `${donors.join(", ")} — recorded cluster-mate${donors.length === 1 ? "" : "s"} whose own loop pass ` +
      "reaches a mechanism this program does not. That is a measurement, not a hypothesis, and one compile " +
      "bought it. Read what their source does differently before deriving a spelling of your own.",
    evidence,
    see: ["psx_loop_trace", "notes/file-groupings.md", "prompts/reference/loop.md"],
  }];
}

function detectCalleeTruth(name: string, sourcePath: string, scratch: string): Finding[] {
  let report: TruthReport;
  try {
    report = auditCallees(name, sourcePath, scratch);
  } catch {
    return [];
  }

  const findings: Finding[] = [];
  const contradicted = report.callees.filter((item) => item.status === "contradicted");
  if (contradicted.length > 0) {
    findings.push({
      detector: "callee-truth",
      severity: "blocker",
      summary:
        `${contradicted.length} callee declaration(s) in scope are contradicted by evidence that ` +
        "does not depend on this source. Each one changes the code emitted at its call site, so no " +
        "rewrite of this function's body can remove what it adds — and every measurement taken " +
        "under it scored a different program. Fix the declaration and re-measure from scratch.",
      evidence: contradicted.flatMap((item) => [
        `${item.callee}: in scope as ${item.declared?.signature ?? "(none)"}`,
        ...item.contradictions.filter((c) => c.proven).map((c) => `  ${c.message}`),
      ]),
      see: ["prompts/reference/declarations.md", "prompts/reference/stuck.md"],
    });
  }

  /* Authored signatures nothing outside this repository corroborates. Not a
   * defect — most functions in the binary have no header — but it is the set
   * a stuck session should re-derive before it concludes anything is
   * unreachable, because it is the set it invented. */
  const unwitnessed = report.callees.filter((item) => item.status === "unwitnessed");
  const disputed = report.callees.filter((item) => item.status === "disputed");
  if (unwitnessed.length > 0 || disputed.length > 0) {
    findings.push({
      detector: "callee-truth",
      severity: "signal",
      summary:
        `${unwitnessed.length} callee signature(s) rest on nothing but this project's own ` +
        `authoring, and ${disputed.length} disagree with another reconstruction without costing ` +
        "an instruction today. Neither blocks a measurement. Both are where a residual that " +
        "survives every rewrite usually turns out to have come from.",
      evidence: [
        ...unwitnessed.map((item) =>
          `${item.callee}: authored as ${item.declared?.signature ?? "(none)"} — ` +
          `${item.witnesses.find((w) => w.kind === "target")?.arity
            ? `the target proves arity >= ${item.witnesses.find((w) => w.kind === "target")!.arity!.min}`
            : "no target evidence"}`),
        ...disputed.flatMap((item) => item.contradictions.map((c) => `${item.callee}: ${c.message}`)),
      ],
      see: ["prompts/reference/stuck.md", "notes/file-groupings.md"],
    });
  }
  return findings;
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

/**
 * An exhausted search whose axis was empty.
 *
 * `searchResidualSourceSpace` reports a terminal `exhausted-no-exact` against
 * the grammar it derived, which is honest and easy to over-read: a rule can be
 * active and still have nothing to enumerate, because every candidate it would
 * have acted on was excluded upstream. Exhausting a domain that excludes the
 * thing you are looking for proves nothing about it, and the result looks
 * exactly like proof.
 *
 * So this reads the run's own grammar and reports the axes that were empty,
 * with the recorded reasons. Only runs whose baseline source hash still equals
 * the source on disk are read; a stale run is not a reading of this program.
 */
export function detectSearchDomain(
  name: string,
  srcText?: string,
  searchRoot: string = join(ROOT, "build/residualSourceSearch"),
): Finding[] {
  if (srcText === undefined) return [];
  const root = join(searchRoot, name);
  if (!existsSync(root)) return [];

  const wanted = sha256(srcText);
  /* Among the runs that are readings of *this* source, the one to report is
   * the strongest evidence, never the most recent: a terminal run outranks a
   * sample, more coverage outranks less, and the run id breaks the tie so the
   * choice is deterministic. Picking by modification time would make the
   * finding depend on which run happened to be re-run last. */
  const strength = (summary: SearchSummary): [number, number] => [
    summary.classesSource?.sampled === false ? 1 : 0,
    Number(summary.classesSource?.evaluatedCandidates ?? "0"),
  ];
  let newest: { grammar: SearchGrammar; summary: SearchSummary; runId: string } | undefined;
  for (const entry of readdirSync(root).sort()) {
    const directory = join(root, entry);
    try {
      const baseline = JSON.parse(readFileSync(join(directory, "baseline.json"), "utf-8")) as { sourceHash?: string };
      if (baseline.sourceHash !== wanted) continue;
      const grammar = JSON.parse(readFileSync(join(directory, "grammar.json"), "utf-8")) as SearchGrammar;
      const summary = JSON.parse(readFileSync(join(directory, "summary.json"), "utf-8")) as SearchSummary;
      if (newest) {
        const [terminal, covered] = strength(summary);
        const [bestTerminal, bestCovered] = strength(newest.summary);
        if (terminal < bestTerminal || (terminal === bestTerminal && covered <= bestCovered)) continue;
      }
      newest = { grammar, summary, runId: entry };
    } catch {
      /* A partial or interrupted run directory is not a reading. */
    }
  }
  if (!newest) return [];

  const { grammar, summary, runId } = newest;
  const terminal = summary.status === "exhausted-no-exact";
  const active = new Set(grammar.activeRules ?? []);
  const findings: Finding[] = [];

  /* Reasons the run already wrote down for excluding something. These are the
   * actionable half: they name what to change to make the axis non-empty. */
  const exclusions = (grammar.caveats ?? []).filter((line) =>
    /stays frozen|stays inside|frozen at|Shadowed|cannot compose|declared /.test(line));

  const empty: Array<{ rule: string; what: string }> = [];
  if (active.has("web-partition") && (grammar.partitionWebIds ?? []).length === 0) {
    empty.push({
      rule: "web-partition",
      what: `0 of ${(grammar.webs ?? []).length} value web(s) were partitionable`,
    });
  }
  if (active.has("statement-order") && (grammar.regions ?? []).length === 0) {
    empty.push({ rule: "statement-order", what: "no block produced an order region" });
  }
  for (const axis of summary.axisEffects ?? []) {
    if (axis.inert) empty.push({ rule: `axis ${axis.id}`, what: `radix ${axis.radix}, one program across ${axis.sampled} value(s)` });
  }

  /* A run that only sampled has no verdict to lend, whatever its class table
   * looks like. This is separate from an empty axis: the axes may be fine and
   * the run still not be a result. */
  if (summary.classesSource?.sampled && summary.classes !== undefined) {
    findings.push({
      detector: "search-domain",
      severity: "signal",
      summary:
        `the strongest residual-source-search run for this source (${runId.slice(0, 8)}) evaluated ` +
        `${summary.classesSource.evaluatedCandidates} of ${summary.classesSource.totalCandidates} candidate(s). ` +
        "Its class table is a sample sized to time a compile, not a ranking over the domain, so nothing in it " +
        "supports a statement about what the domain does or does not contain. Exhaust it before concluding.",
      evidence: [
        `status: ${summary.status}`,
        `artifacts: build/residualSourceSearch/${name}/${runId}/summary.txt`,
      ],
      see: ["tools/agent/residual-source-search/README.md"],
    });
  }

  if (empty.length === 0) return findings;

  findings.push({
    detector: "search-domain",
    severity: terminal ? "blocker" : "signal",
    summary:
      `residual-source-search run ${runId.slice(0, 8)} lists ${empty.map((item) => item.rule).join(" and ")} as ` +
      `active, but ${empty.length === 1 ? "that axis is" : "those axes are"} empty ` +
      `(${empty.map((item) => item.what).join("; ")}). ` +
      (terminal
        ? "The run reported exhausted-no-exact, which is a claim about the domain it built, not about the " +
          "rewrites the axis would have covered. Do not read it as a closure over that axis — read the " +
          "exclusion reasons below and make the axis non-empty first."
        : "Anything this run concludes will not cover that axis."),
    evidence: [
      `status: ${summary.status}`,
      `grammar schema ${grammar.grammarSchemaVersion}, active rules: ${[...active].join(", ")}`,
      ...(exclusions.length > 0
        ? exclusions.map((line) => `exclusion: ${line}`)
        : ["the run recorded no exclusion reason for the empty axis; that is itself worth reporting"]),
      `artifacts: build/residualSourceSearch/${name}/${runId}/grammar.json`,
    ],
    see: [
      "tools/agent/residual-source-search/README.md",
      "notes/research/func_80020E58-allocation-residual.md",
    ],
  });
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
  const policyPath = join(ROOT, ".pi/autoloop.json");
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
 * Mirrors .pi/extensions/shared/source-policy.ts, with one
 * added discrimination the gate does not need but an agent does: a top-level
 * asm block that emits a whole function (`.globl`/`.ent`/`.text` in its
 * template) is an established handwritten-assembly reconstruction, not the
 * embedded-asm-inside-compiled-C failure mode this detector is hunting.
 */
function detectAsmPolicy(name: string, srcText: string): Finding[] {
  const container = containerForSymbol(name)?.id ?? "exe";
  return sourceConstructFindings(srcText, loadConfig(ROOT), { name, container }).map(f => ({
    detector: "asm-policy", severity: "blocker", summary: f.message,
    evidence: [f.text ?? `line ${f.line ?? "unknown"}`], see: ["AGENTS.md", "prompts/c-style-guide.md"],
  }));
}

export function nestedFunctionFindings(row: ChainRow | null): Finding[] {
  if (!row || (!row.callee && !row.calls.some(c => c.verdict !== "rejected"))) return [];
  const guidance = row.callee?.guidance ?? (row.calls.some(c => c.verdict === "confirmed-pair") ?
    "Census-paired caller: block-local auto declaration with asm symbol label; use prep's audited prototype, not an ABI guess." :
    "Unpaired/undetermined frame-address candidate: surface evidence only; no caller injection without a proven callee pairing.");
  return [{ detector: "static-chain", severity: "signal", summary: `${row.id}: ${row.verdict}; ${guidance}`,
    evidence: [
      ...row.callee?.entryReads.map(a => `entry-$2 read at 0x${a.toString(16)} (${row.callee!.form})`) ?? [],
      ...row.calls.filter(c => c.verdict !== "rejected").map(c => `0x${c.setup.toString(16)} -> 0x${c.call.toString(16)} ${c.callee ?? "unknown"}: ${c.verdict}; ${c.reason}`),
      ...row.callee?.reasons ?? [],
    ], see: ["tools/diagnostics/nestedFunctionScan.ts", "prompts/reference/declarations.md", "include/common.h"] }];
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

/** Push header identity before source/allocator diagnostics. COP2 content and
 * unmatched regions never establish handwritten origin or grant asm policy. */
export function detectBoundaryPremise(name: string): Finding[] {
  const container = containerForSymbol(name);
  if (!container) return [];
  const segments = loadSubsegments(container);
  const index = segments.findIndex(s => s.name === name && (s.type === "c" || s.type === "asm"));
  if (index < 0) return [];
  const segment = segments[index]!;
  const binaryPath = resolve(ROOT, container.targetPath);
  if (!existsSync(binaryPath) || segment.size <= 0) return [];
  const binary = readFileSync(binaryPath);
  if (segment.rom + segment.size > binary.length) return [];
  const next = segments[index + 1];
  const following = next?.type === "o" && next.rom === segment.rom + segment.size ? followingTextObject(ROOT, next.name) : undefined;
  const premise = boundaryPremise(binary.subarray(segment.rom, segment.rom + segment.size), segment.vram, following);
  if (!premise.missingTerminal && !premise.adjacentReturnPadding) return [];
  return [{
    detector: "boundary-premise",
    severity: premise.missingTerminal && premise.adjacentReturnPadding ? "blocker" : "signal",
    summary: "Validate the function extent and SDK provenance before reconstructing compiled C.",
    evidence: premise.evidence,
    see: ["plans/static-domain-detection/boundary-premise.md", "notes/retros/2026-10-06-outerproduct0-member-collision-retro.md"],
  }];
}

export function webPartitionFindings(report: FingerprintReport): Finding[] {
  if (!report.diff) return [{ detector: "web-partition", severity: "info", summary: "Web alignment unavailable; no spelling directive.", evidence: report.caveats, see: [] }];
  const facts = report.diff.facts;
  const assignments: Finding[] = report.diff.assignments.map(a => ({
    detector: "web-partition", severity: "info",
    summary: `Scratch assignment: ${a.description}, target $${a.targetRegister} vs candidate $${a.candidateRegister}; allocator diagnostic, not a spelling directive.`,
    evidence: [
      a.unchangedGeometry ? "Observed value, web count, birth/death, reads and estimated weight agree; not fused/split." : "Same proven value; observed lifetime/uses also differ.",
      a.pseudo ? `lreg pseudo ${a.pseudo.pseudo}: ${a.pseudo.sets ?? "?"} SET(s), ${a.pseudo.weightedReferences ?? "?"} weighted refs, span ${a.pseudo.allocatorLiveLength ?? "?"}; ${a.pseudo.allocationStage ?? "unknown"} -> $${a.pseudo.hardRegister}.` : "No unique dump-pseudo correspondence; allocation cause undetermined.",
      ...a.overlaps.flatMap(o => [`Reconstructed block ${o.role.block}: pseudo UID ${o.role.birthUid ?? "live-in"}..${o.role.deathUid ?? "live-out"} overlaps explicit $${a.targetRegister} UID ${o.hard.birthUid ?? "live-in"}..${o.hard.deathUid ?? "live-out"}.`, ...(o.requiredRelation ? [`Nonoverlap ordering experiment: UID ${o.requiredRelation.beforeUid} before UID ${o.requiredRelation.afterUid} in pre-allocation RTL; not sufficient for exact allocation.`] : [])]),
      "No verified clean-C spelling follows from reconstructed intervals. Inspect local allocation, then measure a complete clean candidate.",
    ], see: ["prompts/reference/allocation.md"],
  }));
  if (!facts.length && !assignments.length) return [{ detector: "web-partition", severity: "info", summary: report.diff.exactObservedPartition ? "Observed web partition agrees; this does not establish pre-reload pseudo parity." : "No proven web spelling lever; do not interpret undetermined identities as parity.", evidence: [`${report.diff.undetermined.length} undetermined alignments/identities.`], see: ["prompts/reference/allocation.md"] }];
  return [...facts.map((f): Finding => ({ detector: "web-partition", severity: f.confidence === "observed" ? "signal" : "info", summary: `${f.class}: ${f.identity} — ${f.directive.text}`, evidence: [...f.evidence, f.directive.mechanismSheet, f.directive.verification], see: f.directive.citations.map(c => c.path) })), ...assignments];
}

function detectWebPartition(name: string, source: string): Finding[] {
  try {
    const residual = reversePipeline({ functionName: name, source, replay: false }).report.objective;
    if (!allocationDominant(residual)) return [];
    return webPartitionFindings(fingerprintWebPartition(name, { source }));
  } catch (error) {
    return [{ detector: "web-partition", severity: "info", summary: "Web-partition analysis unavailable; no directive was inferred.", evidence: [String(error)], see: [] }];
  }
}

export function macroIdentityFindings(report: MacroFunctionReport): Finding[] {
  if (!report.cop2.count) return [];
  return [{ detector: "macro-identity", severity: "signal", summary: `${report.verdict}: ${report.coverage.explained}/${report.coverage.total} COP2 instructions explained (fraction=${report.coverage.fraction.toFixed(4)}). Test the header-macro representation before source authoring; candidate C is oracle-unverified.`, evidence: [
    `header vintage: ${report.headerVintages.finding}; witnessed=${report.headerVintages.witnessed.join(", ") || "none"}; compatible=${report.headerVintages.compatible.join(", ") || "none"}`,
    `absorbed ASPSX load-delay/GTE-interlock nops: ${report.absorbedNops}`,
    ...report.tiling.flatMap(t => [`${hex(t.start)}–${hex(t.end)} ${t.macro} [${t.header}:${t.line}; ${t.vintage}]`, `ORACLE-UNVERIFIED: ${t.candidateC}`, ...t.operands.map(o => `${o.parameter}=${o.machine} -> ${o.expression ?? "unresolved"}`), ...t.alternatives.map(a => `also compatible: ${a.macro} [${a.header}:${a.line}; ${a.vintage}] ${a.candidateC}`)]),
    ...report.unmatchedCop2.map(a => `unmatched COP2 at ${hex(a)} — origin undetermined`),
    "Macro islands only: recover surrounding C and symbolic operand types; verify the complete function with the byte oracle. COP2 alone is not permission for a full-asm body.",
  ], see: ["plans/static-domain-detection/macro-identity-recognition.md", "prompts/reference/population.md"] }];
}

/* --- main --- */

function main(): void {
  const args = process.argv.slice(2);
  const json = args.includes("--json");
  const srcFlag = args.indexOf("--src");
  const srcOverride = srcFlag >= 0 ? args[srcFlag + 1] : undefined;
  const preparedFlag = args.indexOf("--prepared");
  const prepared = preparedFlag >= 0 ? args[preparedFlag + 1] : undefined;
  const positional = args.filter(
    (a, i) => !a.startsWith("--") && !(srcFlag >= 0 && i === srcFlag + 1) && !(preparedFlag >= 0 && i === preparedFlag + 1)
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

  const findings: Finding[] = detectBoundaryPremise(name);
  const srcPath = srcOverride ?? sourcePathFor(name);
  const srcText = existsSync(srcPath) ? readFileSync(srcPath, "utf-8") : undefined;
  const sourceState: "missing" | "stub" | "c" =
    srcText === undefined ? "missing" : /INCLUDE_ASM/.test(srcText) ? "stub" : "c";

  /* Operation recovery outranks compiler-state tuning: an inventory or frame
   * reading taken while the source hand-expands an SDK packet is a reading of
   * the wrong program, so the SDK finding is emitted first and, being a
   * signal, sorts above the inventory signal that would otherwise lead. */
  const macroIdentity = detectFunctionMacroIdentity(name);
  findings.push(...nestedFunctionFindings(chainRow(nestedFunctionCensus(), name)));
  if (macroIdentity) findings.push(...macroIdentityFindings(macroIdentity.function));
  findings.push(...detectSdkIdioms(target, sourceState === "c" ? srcText : undefined));

  let frameConverged = false;
  if (sourceState === "c" && srcText !== undefined) {
    findings.push(...detectAsmPolicy(name, srcText));
    findings.push(...detectCalleeTruth(name, resolveSource(name, srcOverride), scratch));
    const compiled = readCompiled(name, resolveSource(name, srcOverride), scratch, prepared);
    if (compiled) {
      findings.push(...detectUndeclaredCallee(compiled));
      const arity = detectArityFrame(target, compiled);
      frameConverged = arity.length === 0;
      findings.push(...arity);
      findings.push(...detectInventory(target, compiled));
      findings.push(...detectDeadAsm(compiled, srcText));
      findings.push(...detectWebPartition(name, resolveSource(name, srcOverride)));
      findings.push(...detectSelfSimilarity(name, resolveSource(name, srcOverride)));
      /* Before the preheader-order reading, because a phony loop invalidates
       * that reading's whole subject: the emission classes it reasons about
       * were never assigned inside a loop nothing scanned. */
      findings.push(...detectPhonyLoop(name, resolveSource(name, srcOverride)));
      findings.push(...detectLoopPreheaderOrder(name, resolveSource(name, srcOverride)));
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
  findings.push(...detectSearchDomain(name, sourceState === "c" ? srcText : undefined));
  findings.push(...detectPremiseSurvival(name));
  /* Unconditional, like the idiom precedent below and for the same reason: it
   * needs no source of its own. A parked function whose file is still a stub is
   * exactly who a cluster-mate's measured trace is worth most to. */
  findings.push(...detectClusterDonor(name, sourceState === "c" ? resolveSource(name, srcOverride) : undefined));
  /* Last because it is the most expensive on a cold cache, and unconditional
     because it is the one detector that needs no source: the query is the
     target's own assembly, which is exactly what a stub has and nothing else
     does. */
  findings.push(...detectIdiomPrecedent(name));
  rmSync(scratch, { recursive: true, force: true });

  if (json) {
    console.log(JSON.stringify({ function: name, sourceState, macroIdentity, findings }, null, 2));
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
