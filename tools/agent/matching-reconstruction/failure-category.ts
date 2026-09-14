/**
 * Typed failure categories — what the reconstruction could not represent, as a
 * closed vocabulary rather than a substring of a prose refusal.
 *
 * The defect this replaces: census buckets were selected by searching a
 * concatenated refusal string for words like "calls another function". A
 * refusal that happens to mention a mechanism is not evidence the function has
 * it, and a refusal that omits one is not evidence it does not — the recorded
 * example is a "read-only, call-free" bucket 443 of whose 510 members contain
 * calls in their own original words. Two things fix it, and both are here:
 *
 *   1. every refusal carries a `FailureCategory` chosen at the throw site, so
 *      the class is stated by the code that knows it rather than recovered
 *      from its own error message;
 *   2. the *population* facts a census reports — calls, stores, loops,
 *      unknown opcodes — are read from the target's decoded words, which are
 *      true whether or not the engine got far enough to mention them.
 *
 * A category is a mechanism, not a severity. `unsupported-target` says the
 * engine stopped; the category says which capability would let it continue,
 * which is the only form of the answer a capability plan can be built from.
 */

import { isBranch, isStore, isUnalignedLoad, isUnalignedStore, type DecodedInsn } from "./decode.js";

/* ---- the closed vocabulary ----------------------------------------------- */

/**
 * Why a reconstruction did not produce an exact candidate.
 *
 * Grouped by the layer that refused: decoder, executor's memory model,
 * executor's control model, the context/evidence layer, the constructors, and
 * the evaluation loop. Every member names a mechanism a capability could
 * supply.
 */
export type FailureCategory =
  /* --- decoder: the word is outside the modelled instruction set --- */
  | "undecoded-opcode"
  | "unaligned-access"
  | "trap-packet"
  | "coprocessor"
  | "unmodelled-instruction"
  | "unmodelled-branch"
  /* --- memory model --- */
  | "computed-address"
  | "mixed-width-overlap"
  | "misaligned-access"
  | "store-budget"
  /* --- control model --- */
  | "nonlocal-control"
  | "indirect-jump"
  | "nonterminating-cycle"
  | "loop-induction-origin"
  | "nested-loop"
  | "loop-interaction"
  | "delay-slot-control"
  | "unbalanced-frame"
  | "fell-off-end"
  | "state-budget"
  | "step-budget"
  | "decision-depth"
  /* --- arithmetic --- */
  | "division-by-zero"
  /* --- context and evidence --- */
  | "no-origin-evidence"
  | "callee-signature-unknown"
  | "call-result-unbound"
  | "parameter-plan-unavailable"
  /* --- constructors --- */
  | "relation-unfit"
  | "structure-unsupported"
  /* --- evaluation --- */
  | "domain-exhausted"
  | "budget-exhausted"
  | "oracle-undetermined"
  | "input-drift"
  | "tool-failure";

/** Which layer a category belongs to; the axis a capability plan groups by. */
export type FailureLayer = "decoder" | "memory" | "control" | "arithmetic" | "context" | "constructor" | "evaluation";

const LAYER_OF: Record<FailureCategory, FailureLayer> = {
  "undecoded-opcode": "decoder",
  "unaligned-access": "decoder",
  "trap-packet": "decoder",
  coprocessor: "decoder",
  "unmodelled-instruction": "decoder",
  "unmodelled-branch": "decoder",
  "computed-address": "memory",
  "mixed-width-overlap": "memory",
  "misaligned-access": "memory",
  "store-budget": "memory",
  "nonlocal-control": "control",
  "indirect-jump": "control",
  "nonterminating-cycle": "control",
  "loop-induction-origin": "control",
  "nested-loop": "control",
  "loop-interaction": "control",
  "delay-slot-control": "control",
  "unbalanced-frame": "control",
  "fell-off-end": "control",
  "state-budget": "control",
  "step-budget": "control",
  "decision-depth": "control",
  "division-by-zero": "arithmetic",
  "no-origin-evidence": "context",
  "callee-signature-unknown": "context",
  "call-result-unbound": "context",
  "parameter-plan-unavailable": "context",
  "relation-unfit": "constructor",
  "structure-unsupported": "constructor",
  "domain-exhausted": "evaluation",
  "budget-exhausted": "evaluation",
  "oracle-undetermined": "evaluation",
  "input-drift": "evaluation",
  "tool-failure": "evaluation",
};

export function failureLayer(category: FailureCategory): FailureLayer {
  return LAYER_OF[category];
}

export const ALL_FAILURE_CATEGORIES = Object.keys(LAYER_OF) as FailureCategory[];

/* ---- target-derived feature tags ----------------------------------------- */

/**
 * What the original words contain, independent of how far the engine got.
 *
 * These are the facts a census may bucket by. They are read from the decode,
 * so a function that "calls another function" is one whose words contain a
 * `jal`/`jalr` — not one whose refusal happened to say so.
 */
export interface TargetFeatures {
  words: number;
  hasCalls: boolean;
  hasIndirectCalls: boolean;
  hasStores: boolean;
  /** A branch or jump whose target is at or before it: an internal back edge. */
  hasBackEdge: boolean;
  /** Words the decoder does not model at all, by opcode class. */
  unknownOpcodes: UnknownOpcodeTag[];
  /**
   * Unaligned word accesses (`lwl`/`lwr`/`swl`/`swr`).
   *
   * Decoded but not executable as scalar accesses: they are the backend's
   * expansion of an unaligned or aggregate copy, and the useful recovery is
   * the copy, not the two halves. Counted separately from `unknownOpcodes`
   * because "the decoder has never seen this word" and "this word is ordinary
   * compiler output the executor does not model" are different problems.
   */
  unalignedAccesses: number;
  /** `break` instructions — compiler trap packets, or something else. */
  trapPackets: number;
}

/**
 * How one undecoded word is classified. `break` and the unaligned accesses are
 * ordinary compiler output; COP2 may be an SDK macro expansion or handwritten
 * code, and only that distinction makes the bucket actionable.
 */
export type UnknownOpcodeTag = "lwl-lwr" | "swl-swr" | "break" | "cop2" | "cop0" | "other";

/** Classify one raw word the decoder returned `unknown` for. */
export function classifyUnknownWord(word: number): UnknownOpcodeTag {
  const opcode = (word >>> 26) & 0x3f;
  if (opcode === 0x22 || opcode === 0x26) return "lwl-lwr";
  if (opcode === 0x2a || opcode === 0x2e) return "swl-swr";
  if (opcode === 0x12) return "cop2";
  if (opcode === 0x10) return "cop0";
  if (opcode === 0x32 || opcode === 0x3a) return "cop2"; /* lwc2 / swc2 */
  if (opcode === 0 && (word & 0x3f) === 0x0d) return "break";
  return "other";
}

export function targetFeatures(insns: DecodedInsn[]): TargetFeatures {
  const unknown = new Set<UnknownOpcodeTag>();
  let hasCalls = false;
  let hasIndirectCalls = false;
  let hasStores = false;
  let hasBackEdge = false;
  let unalignedAccesses = 0;
  let trapPackets = 0;
  for (const insn of insns) {
    if (insn.op === "jal") hasCalls = true;
    else if (insn.op === "jalr") { hasCalls = true; hasIndirectCalls = true; }
    else if (isUnalignedStore(insn.op)) { hasStores = true; unalignedAccesses++; }
    else if (isUnalignedLoad(insn.op)) unalignedAccesses++;
    else if (insn.op === "break") trapPackets++;
    else if (isStore(insn.op)) hasStores = true;
    else if (insn.op === "unknown") unknown.add(classifyUnknownWord(insn.word));
    if ((isBranch(insn.op) || insn.op === "j") && insn.target !== undefined && insn.target <= insn.vram) {
      hasBackEdge = true;
    }
  }
  return {
    words: insns.length,
    hasCalls,
    hasIndirectCalls,
    hasStores,
    hasBackEdge,
    unknownOpcodes: [...unknown].sort(),
    unalignedAccesses,
    trapPackets,
  };
}

/**
 * A census line for one function: its typed category and the target facts,
 * never a prose bucket. Reported as `category (layer)` with the population
 * tags appended so a reader can see, for instance, that an
 * `undecoded-opcode` refusal is `lwl-lwr` rather than `cop2`.
 */
export function describeCategory(category: FailureCategory, features?: TargetFeatures): string {
  const tags: string[] = [`${category} [${failureLayer(category)}]`];
  if (features) {
    const facts: string[] = [];
    if (features.hasCalls) facts.push(features.hasIndirectCalls ? "calls(indirect)" : "calls");
    if (features.hasStores) facts.push("stores");
    if (features.hasBackEdge) facts.push("back-edge");
    if (features.unknownOpcodes.length > 0) facts.push(features.unknownOpcodes.join("+"));
    if (features.unalignedAccesses > 0) facts.push(`unaligned×${features.unalignedAccesses}`);
    if (features.trapPackets > 0) facts.push(`break×${features.trapPackets}`);
    if (facts.length > 0) tags.push(facts.join(","));
  }
  return tags.join(" ");
}
