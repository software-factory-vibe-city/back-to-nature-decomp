/**
 * phony.ts — why the pass refused to scan a loop.
 *
 * `scan_loop` computes `scan_start` as the first label or insn after
 * `NOTE_INSN_LOOP_BEG` (skipping notes, but never past another loop's begin or
 * end note), follows an unconditional entry jump to its label when it can, and
 * then discards the loop outright:
 *
 *     if (INSN_UID (scan_start) >= max_uid_for_loop
 *         || GET_CODE (scan_start) != CODE_LABEL)
 *       { ... "Loop from %d to %d is phony." ; return; }
 *
 * The log prints that one line and stops. What it does not print is the
 * consequence — *nothing* inside the loop was scanned, so every movable, giv
 * and biv fact for it is absent rather than negative — nor the cause, which is
 * what decides the antidote.
 *
 * The cause is readable from the RTL the same dump already carries, because a
 * discarded loop is a loop the pass did not touch: the insns between its note
 * and its entry are still exactly where the pass found them. This reproduces
 * the `scan_start` walk over that stream and reports what it landed on. Where
 * the stream does not settle it, the cause is `undetermined` — the walk is a
 * model of `loop.c`, and a model that guesses is worse than one that abstains.
 */

import type { LoopRecord, PhonyCause } from "./types.js";

/** One top-level expression of a `print_rtl` dump, in stream order. */
export interface RtlNode {
  uid: number;
  /** `note`, `insn`, `jump_insn`, `call_insn`, `code_label`, `barrier`. */
  kind: string;
  /** `NOTE_INSN_LOOP_BEG` and friends, for a note that names its kind. */
  note?: string;
  text: string;
}

const CARRIES_CODE = new Set(["insn", "jump_insn", "call_insn"]);

export function parseRtlNode(text: string): RtlNode | undefined {
  const head = text.match(/^\((note|insn|jump_insn|call_insn|code_label|barrier)(?:\/[a-z]+)*\s+(\d+)/);
  if (!head) return undefined;
  const node: RtlNode = { uid: Number(head[2]), kind: head[1]!, text };
  const note = text.match(/\bNOTE_INSN_[A-Z_]+/);
  if (note) node.note = note[0];
  return node;
}

/** Symbols an insn's pattern names, in the order they appear. */
function symbolsOf(text: string): string[] {
  return [...new Set([...text.matchAll(/symbol_ref:[A-Z]+\s+\("([^"]+)"\)/g)].map((match) => match[1]!))];
}

/**
 * `scan_loop`'s own walk: the first label or insn after the loop's begin note,
 * never stepping past a nested loop's begin or end note.
 */
function scanStartIndex(nodes: RtlNode[], start: number, end: number): number | undefined {
  for (let index = start + 1; index < nodes.length; index++) {
    const node = nodes[index]!;
    /* `p != end` — the loop's own end note terminates the walk. */
    if (node.uid === end) return index;
    if (node.kind === "code_label") return index;
    if (CARRIES_CODE.has(node.kind)) return index;
    if (node.kind === "note" && (node.note === "NOTE_INSN_LOOP_BEG" || node.note === "NOTE_INSN_LOOP_END")) {
      return index;
    }
  }
  return undefined;
}

/** The label a simple jump targets, when it is one. */
function simpleJumpTarget(text: string): number | undefined {
  const matched = text.match(/\(set\s+\(pc\)\s+\(label_ref(?:\/[a-z]+)*\s+(\d+)\)\)/);
  return matched ? Number(matched[1]) : undefined;
}

/**
 * Resolve one phony loop's cause against the RTL stream.
 *
 * Every branch states which of `scan_loop`'s two tests it attributes the
 * discard to, because the antidotes differ: an insn before the entry is a
 * layout problem the source's loop tail controls, and a loop-created
 * `scan_start` is not.
 */
export function phonyCause(loop: LoopRecord, nodes: RtlNode[]): PhonyCause {
  const noteIndex = nodes.findIndex((node) =>
    node.uid === loop.from && node.kind === "note" && node.note === "NOTE_INSN_LOOP_BEG");
  if (noteIndex < 0) {
    return {
      kind: "undetermined",
      detail:
        `no NOTE_INSN_LOOP_BEG with UID ${loop.from} is in this dump's RTL, so scan_start cannot be ` +
        "reproduced. The dump's RTL is written after both passes; a loop the second pass rewrote is " +
        "the case this cannot read.",
    };
  }

  const startIndex = scanStartIndex(nodes, noteIndex, loop.to);
  const scanStart = startIndex === undefined ? undefined : nodes[startIndex]!;
  if (!scanStart) {
    return {
      kind: "undetermined",
      detail: `the RTL after note ${loop.from} ends before a label or insn, so scan_start is not readable here.`,
    };
  }
  const where = { uid: scanStart.uid, kind: scanStart.kind };

  if (scanStart.kind === "code_label") {
    return {
      kind: "loop-created-scan-start",
      scanStart: where,
      detail:
        `scan_start is label ${scanStart.uid}, which passes the CODE_LABEL test — so the discard is the ` +
        "other one: INSN_UID (scan_start) >= max_uid_for_loop, i.e. an earlier pass created that label " +
        "and loop_reg_used_before_p cannot read its luid.",
    };
  }

  if (scanStart.kind === "jump_insn") {
    const target = simpleJumpTarget(scanStart.text);
    const targetIndex = target === undefined
      ? -1
      : nodes.findIndex((node) => node.uid === target && node.kind === "code_label");
    const inRange = targetIndex > noteIndex
      && targetIndex < nodes.findIndex((node) => node.uid === loop.to);
    return {
      kind: "entry-jump",
      scanStart: where,
      detail: target === undefined
        ? `the loop is entered through jump ${scanStart.uid}, which is not a simple jump, so scan_loop ` +
          "left scan_start on the jump itself and the CODE_LABEL test failed."
        : inRange
          ? `the loop is entered through jump ${scanStart.uid} to label ${target}, which is inside the ` +
            "loop — so scan_start became that label and the discard is the UID test on it: label " +
            `${target} was created by an earlier pass.`
          : `the loop is entered through jump ${scanStart.uid} to label ${target}, which is not inside ` +
            `${loop.from}..${loop.to}, so scan_loop refused to follow it and scan_start stayed the jump.`,
    };
  }

  /* An insn — the gcse case. Report the whole run up to the real entry, since
     it is the run that has to move, not just its first member. */
  const intruders: RtlNode[] = [];
  for (let index = startIndex!; index < nodes.length; index++) {
    const node = nodes[index]!;
    if (node.kind === "code_label" || node.kind === "jump_insn" || node.uid === loop.to) break;
    if (CARRIES_CODE.has(node.kind)) intruders.push(node);
  }
  const symbols = [...new Set(intruders.flatMap((node) => symbolsOf(node.text)))];
  const cause: PhonyCause = {
    kind: "insns-before-entry",
    scanStart: where,
    intruders: intruders.map((node) => node.uid),
    detail:
      `${intruders.length} insn${intruders.length === 1 ? "" : "s"} (${intruders.map((node) => node.uid).join(", ")}) ` +
      `sit between NOTE_INSN_LOOP_BEG ${loop.from} and the loop's entry, so scan_start is insn ` +
      `${scanStart.uid} rather than a label. Their UIDs are above the loop's own, so an earlier pass ` +
      "put them there — gcse's PRE insertions are the case this project has measured.",
  };
  if (symbols.length > 0) cause.symbols = symbols;
  return cause;
}

/** Attach a cause to every phony loop a trace recorded. */
export function resolvePhonyCauses(loops: LoopRecord[], nodes: RtlNode[]): void {
  for (const loop of loops) {
    if (!loop.phony) continue;
    loop.phonyCause = phonyCause(loop, nodes);
  }
}

/**
 * What a phony loop costs the reader, in the reader's own terms.
 *
 * Kept next to the detection because the consequence is the point: a quiet
 * "phony, discarded" line reads as bookkeeping, and it is not. It means every
 * per-iteration placement experiment inside that loop silently became an
 * experiment at the enclosing level — which is a regime a session may already
 * have refuted, so the result looks like confirmation.
 */
export const PHONY_CONSEQUENCE = [
  "The pass never scanned this loop. No movable was recorded, no biv or giv was found, and nothing",
  "was hoisted into its preheader — so every movable/giv/biv fact for it is ABSENT, not negative,",
  "and any reasoning that treats its silence as a decision is void. A phony INNER loop is the",
  "expensive case: each per-iteration placement it was supposed to carry becomes an emission at the",
  "enclosing loop instead, which is a different regime and often one already refuted.",
];

export function phonyAntidote(cause: PhonyCause | undefined): string[] {
  switch (cause?.kind) {
    case "insns-before-entry":
      return [
        "ANTIDOTE: give the loop a fallthrough entry, so an earlier pass's insertions land BEFORE the",
        "loop note instead of after it. In source terms that is the loop tail: a compound `&&` tail lays",
        "the loop out with an entry jump and leaves the gap these insns landed in; a tail that breaks out",
        "of the body and tests one condition at the bottom keeps the fallthrough entry and no gap exists.",
      ];
    case "entry-jump":
      return [
        "ANTIDOTE: the entry jump is the problem. A loop entered by a jump scan_loop cannot follow is",
        "never scanned; a fallthrough entry — one condition at the bottom of the body, the rest broken",
        "out of — removes the jump and the question.",
      ];
    case "loop-created-scan-start":
      return [
        "ANTIDOTE: none in this loop's own spelling — the label was created by an earlier pass and only",
        "the shape that produced it can be changed. Look at what runs before loop (gcse, jump) on this",
        "region rather than at the loop body.",
      ];
    default:
      return [
        "ANTIDOTE: undetermined, because the cause is. Read the RTL around the loop note in the dump",
        "psx_loop_trace names, and check what scan_start is.",
      ];
  }
}
