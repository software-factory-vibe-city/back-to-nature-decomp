/**
 * parse.ts — read GCC 2.95's `-dL` loop log.
 *
 * The grammar is every `fprintf (loop_dump_stream, ...)` in the vendored
 * `loop.c` and in the `unroll.c` routines it calls (`loop_iterations`,
 * `final_biv_value`, `final_giv_value`), which reach the same stream. It is
 * transcribed rather than sampled: a log line this parser does not recognise
 * is reported, never dropped, because a dropped line is a decision the reader
 * believes they saw.
 *
 * Two structural facts about the file:
 *
 * - The pass runs twice at `-O2` (`flag_rerun_loop_opt`) and both runs write
 *   into one dump under one `;; Function` header. There is no pass marker, so
 *   a boundary is derived: the point where a `Loop from A to B` range that has
 *   already been seen reappears. The number of passes is therefore reported,
 *   not assumed — `-O1` runs the pass once.
 * - The post-pass RTL follows each function's messages, and the dump file is
 *   opened with `"a"`, so a translation unit with several functions produces
 *   several `;; Function` sections in one file and a re-compile appends to
 *   whatever was there. Nothing the pass logs starts a line with `(` at column
 *   zero, which is what separates a `print_rtl` expression from a message;
 *   `wantFunction` selects one section out of the file.
 */

import { parseRtlNode, resolvePhonyCauses, type RtlNode } from "./phony.js";
import type {
  BasicInductionVariable,
  CombineStatistics,
  GeneralInductionVariable,
  LoopRecord,
  LoopTrace,
  Movable,
  MovableDecision,
  PassRecord,
  UnrecognisedLine,
} from "./types.js";

/** A line that opens the post-pass RTL dump. */
const RTL_START = /^\((?:note|insn|jump_insn|call_insn|code_label|barrier)\b/;

function emptyLoop(from: number, to: number, insnCount: number): LoopRecord {
  return {
    from, to, insnCount,
    phony: false,
    movables: [], bivs: [], givs: [], combineStatistics: [], notes: [],
  };
}

function parenBalance(text: string): number {
  let depth = 0;
  for (const character of text) {
    if (character === "(") depth++;
    else if (character === ")") depth--;
  }
  return depth;
}

/**
 * Join a message with any continuation lines its `print_rtl` tail spilled onto.
 *
 * `print_rtl` wraps a large rtx across lines, so `giv at 1211 reduced to ` can
 * be followed by two more lines before the expression closes. Balance is the
 * only reliable terminator: the messages themselves never leave a paren open.
 */
function logicalLine(lines: string[], index: number): { text: string; next: number } {
  let text = lines[index]!;
  let cursor = index;
  let depth = parenBalance(text);
  while (depth > 0 && cursor + 1 < lines.length) {
    cursor++;
    text += ` ${lines[cursor]!.trim()}`;
    depth += parenBalance(lines[cursor]!);
  }
  return { text, next: cursor + 1 };
}

/**
 * Split a movable's flag tail.
 *
 * `move_movables` prints the flags in a fixed order and then, only if the
 * safety gate passed, `savings %d ` and the decision. The order is what makes
 * this readable without ambiguity: `matches %d` and `forces %d` both take a
 * UID, and only their position distinguishes them from `savings %d`.
 */
function parseMovableTail(tail: string): Omit<Movable, "insn" | "regno" | "life" | "raw"> {
  const flags = {
    consec: undefined as number | undefined,
    cond: false, force: false, global: false, done: false, moveInsn: false,
    matches: undefined as number | undefined,
    forces: undefined as number | undefined,
    savings: undefined as number | undefined,
    halved: false,
    decision: "skipped" as MovableDecision,
    movedTo: undefined as number | undefined,
  };

  let rest = tail;
  const eat = (pattern: RegExp): RegExpMatchArray | null => {
    const matched = rest.match(pattern);
    if (matched) rest = rest.slice(matched[0].length);
    return matched;
  };

  /* Each flag prints a trailing space, but a movable whose last flag is also
     its last output — a `done ... matches N ` with no decision — loses it to
     the line trim, so the separator is `\s*` and the decision tolerates the
     leading space it would otherwise have kept. */
  const consec = eat(/^consec (\d+),\s*/);
  if (consec) flags.consec = Number(consec[1]);
  if (eat(/^cond\s*/)) flags.cond = true;
  if (eat(/^force\s*/)) flags.force = true;
  if (eat(/^global\s*/)) flags.global = true;
  if (eat(/^done\s*/)) flags.done = true;
  if (eat(/^move-insn\s*/)) flags.moveInsn = true;
  const matches = eat(/^matches (\d+)\s*/);
  if (matches) flags.matches = Number(matches[1]);
  const forces = eat(/^forces (\d+)\s*/);
  if (forces) flags.forces = Number(forces[1]);
  const savings = eat(/^savings (-?\d+)\s*/);
  if (savings) flags.savings = Number(savings[1]);
  if (eat(/^halved since already moved\s*/)) flags.halved = true;

  const moved = rest.match(/^moved to (\d+)$/);
  if (moved) {
    flags.decision = "moved";
    flags.movedTo = Number(moved[1]);
  } else if (rest === "not desirable") {
    flags.decision = "not desirable";
  } else if (rest === "not safe") {
    flags.decision = "not safe";
  }
  return flags;
}

function parseGivHead(text: string): GeneralInductionVariable | undefined {
  const head = text.match(/^Insn (\d+): (?:giv reg (\d+)|dest address) src reg (\d+) benefit (-?\d+) lifetime (-?\d+)(.*)$/);
  if (!head) return undefined;
  let tail = head[6] ?? "";
  const giv: GeneralInductionVariable = {
    insn: Number(head[1]),
    destAddress: head[2] === undefined,
    reg: head[2] === undefined ? undefined : Number(head[2]),
    srcReg: Number(head[3]),
    benefit: Number(head[4]),
    lifetime: Number(head[5]),
    replaceable: false,
    ncav: false,
  };
  if (tail.startsWith(" replaceable")) { giv.replaceable = true; tail = tail.slice(" replaceable".length); }
  if (tail.startsWith(" ncav")) { giv.ncav = true; tail = tail.slice(" ncav".length); }
  /* `mult` and `add` each print either a decimal or an rtx, so they are taken
     as everything up to the next keyword rather than by shape. */
  const mult = tail.match(/^ mult (.*?)(?= add |$)/);
  if (mult) { giv.mult = mult[1]!.trim(); tail = tail.slice(mult[0].length); }
  const add = tail.match(/^ add (.*)$/);
  if (add) giv.add = add[1]!.trim();
  return giv;
}

/** Recognised lines that carry no structure this tool models. */
const NOTE_PATTERNS: RegExp[] = [
  /^First use: insn \d+, last use: insn \d+\.$/,
  /^Found branch outside giv lifetime\.$/,
  /^Increment \d+ of biv \d+ converted to giv \d+\.$/,
  /^Can reverse loop$/,
  /^Reversed loop(?: and added reg_nonneg)?$/,
  /^Hoisted regno \d+ (?:r\/w|r\/o) from /,
  /^insert_bct[: ]/,
  /^Loop iterations: /,
  /^Loop unrolling: /,
  /^Unrolling loop \d+ times\.$/,
  /^Unrolling failure: /,
  /^Preconditioning: /,
  /^Final biv value for \d+, /,
  /^Final giv value for \d+, /,
  /^Biv \d+ (?:initial value remapped to \d+|mapped to \d+ for split|safe to split)\.$/,
  /^Giv \d+ (?:at insn \d+ safe to split|mapped to \d+ for split)\.$/,
  /^DEST_ADDR giv being split\.$/,
  /^giv combined with unreduced giv not split\.$/,
  /^Splitting not safe, because loop not entered at top\.$/,
  /^(?:Did not mark|Marked) reg \d+ as local$/,
  /^Eliminating constant from giv \d+$/,
  /^Sharing address givs in insn \d+$/,
  /^Invalid address for giv at insn \d+$/,
  /^Invalid init insn, rewritten\.$/,
];

export function parseLoopDump(dump: string, wantFunction?: string): LoopTrace {
  const lines = dump.split("\n");
  const passes: PassRecord[] = [];
  const unrecognised: UnrecognisedLine[] = [];
  let functionName = "";
  let rtlStartsAt = lines.length;

  let pass: PassRecord = { index: 1, loops: [] };
  let seenRanges = new Set<string>();
  let loop: LoopRecord | undefined;
  /** The giv whose `Sorted combine statistics:` table is being read, if any. */
  let expectCombineTable = false;
  /**
   * The post-pass RTL, kept only once a phony loop has been seen.
   *
   * A discarded loop is a loop the pass did not touch, so the stream still
   * shows what `scan_start` was — which is the whole cause. Collecting it
   * unconditionally would put a few thousand expressions into every stored
   * trace for a fact almost no function needs; the messages precede the RTL in
   * the dump, so by the time this matters the answer is already known.
   */
  const rtl: RtlNode[] = [];
  let anyPhony = false;

  const push = (record: LoopRecord): void => {
    const key = `${record.from}..${record.to}`;
    if (seenRanges.has(key)) {
      passes.push(pass);
      pass = { index: pass.index + 1, loops: [] };
      seenRanges = new Set<string>();
    }
    seenRanges.add(key);
    pass.loops.push(record);
    loop = record;
  };

  const bivFor = (regno: number): BasicInductionVariable => {
    const existing = loop?.bivs.find((biv) => biv.regno === regno);
    if (existing) return existing;
    const created: BasicInductionVariable = { regno, candidates: [], verified: false, eliminated: false };
    loop?.bivs.push(created);
    return created;
  };
  const givFor = (insn: number): GeneralInductionVariable | undefined =>
    loop?.givs.find((giv) => giv.insn === insn);

  let index = 0;
  /* Set while the file is inside a `;; Function` section other than the one
     asked for. Only reachable when a translation unit defines several. */
  let skipping = false;

  while (index < lines.length) {
    const physical = lines[index]!;
    if (RTL_START.test(physical)) {
      /* A `print_rtl` expression, not a message. Consume the whole sexp so a
         wrapped operand line is never read as a log line. */
      if (!skipping && rtlStartsAt > index) rtlStartsAt = index + 1;
      const expression = logicalLine(lines, index);
      if (!skipping && anyPhony) {
        const node = parseRtlNode(expression.text);
        if (node) rtl.push(node);
      }
      index = expression.next;
      continue;
    }
    if (physical.trim() === "") { index++; continue; }

    const { text, next } = logicalLine(lines, index);
    const lineNumber = index + 1;
    index = next;
    const trimmed = text.trimEnd();

    const header = trimmed.match(/^;; Function (\S+)/);
    if (header) {
      skipping = wantFunction !== undefined && header[1] !== wantFunction;
      if (!skipping) functionName = header[1]!;
      continue;
    }
    if (skipping) continue;
    /* Every other `;;` line is a dump comment, not a pass decision. */
    if (trimmed.startsWith(";;")) continue;

    /* A combine table follows its header, and it is the one message that is a
       bare list rather than a sentence. An *empty* table prints only a blank
       line, which the blank-line skip above already consumed — so an entryless
       reading means the table was empty and this line is the next message. */
    if (expectCombineTable) {
      expectCombineTable = false;
      const entries: CombineStatistics = [...trimmed.matchAll(/\{(\d+), (-?\d+)\}/g)]
        .map((entry) => ({ insn: Number(entry[1]), totalBenefit: Number(entry[2]) }));
      loop?.combineStatistics.push(entries);
      if (entries.length > 0) continue;
    }

    let matched: RegExpMatchArray | null;

    if ((matched = trimmed.match(/^Loop from (\d+) to (\d+): (\d+) real insns\.$/))) {
      push(emptyLoop(Number(matched[1]), Number(matched[2]), Number(matched[3])));
      continue;
    }
    if ((matched = trimmed.match(/^Loop from (\d+) to (\d+) is phony\.$/))) {
      const record = emptyLoop(Number(matched[1]), Number(matched[2]), 0);
      record.phony = true;
      anyPhony = true;
      push(record);
      continue;
    }
    if ((matched = trimmed.match(/^Loop at (\d+) ignored due to (.+)\.$/))) {
      const record = emptyLoop(Number(matched[1]), Number(matched[1]), 0);
      record.ignored = matched[2]!;
      push(record);
      continue;
    }
    if ((matched = trimmed.match(/^Continue at insn (\d+)\.$/))) {
      if (loop) loop.continueAt = Number(matched[1]);
      continue;
    }
    if ((matched = trimmed.match(/^Insn (\d+): regno (\d+) \(life (-?\d+)\), (.*)$/))) {
      const movable: Movable = {
        insn: Number(matched[1]),
        regno: Number(matched[2]),
        life: Number(matched[3]),
        raw: trimmed,
        ...parseMovableTail(matched[4]!),
      };
      loop?.movables.push(movable);
      continue;
    }
    if ((matched = trimmed.match(/^Insn (\d+): possible biv, reg (\d+), const =\s*(.*)$/))) {
      const biv = bivFor(Number(matched[2]));
      biv.candidates.push(Number(matched[1]));
      biv.increment = matched[3]!.trim();
      continue;
    }
    if ((matched = trimmed.match(/^Reg (\d+): biv verified$/))) { bivFor(Number(matched[1])).verified = true; continue; }
    if ((matched = trimmed.match(/^Reg (\d+): biv eliminated$/))) { bivFor(Number(matched[1])).eliminated = true; continue; }
    if ((matched = trimmed.match(/^Reg (\d+): biv discarded, (.*)$/))) {
      bivFor(Number(matched[1])).discarded = matched[2]!;
      continue;
    }
    if ((matched = trimmed.match(/^Biv (\d+) initialized at insn (\d+): initial value (.*)$/))) {
      const biv = bivFor(Number(matched[1]));
      biv.initInsn = Number(matched[2]);
      biv.initialValue = matched[3]!.trim();
      continue;
    }
    if ((matched = trimmed.match(/^Cannot eliminate biv (\d+)(?:: biv used in insn (\d+))?\.$/))) {
      bivFor(Number(matched[1])).cannotEliminate = { usedIn: matched[2] ? Number(matched[2]) : undefined };
      continue;
    }
    if ((matched = trimmed.match(/^biv (\d+) (can|cannot) be eliminated\.$/))) {
      bivFor(Number(matched[1])).eliminable = matched[2] === "can";
      continue;
    }
    if ((matched = trimmed.match(/^Insn (\d+): giv reg (\d+) final_value replaceable$/))) {
      const giv = givFor(Number(matched[1]));
      if (giv) giv.finalValueReplaceable = true;
      else loop?.notes.push(trimmed);
      continue;
    }
    {
      const giv = parseGivHead(trimmed);
      if (giv) { loop?.givs.push(giv); continue; }
    }
    if (trimmed === "Sorted combine statistics:") { expectCombineTable = true; continue; }
    if ((matched = trimmed.match(/^giv at (\d+) combined with giv at (\d+)$/))) {
      const giv = givFor(Number(matched[1]));
      if (giv) giv.combinedWith = Number(matched[2]);
      else loop?.notes.push(trimmed);
      continue;
    }
    if ((matched = trimmed.match(/^giv at (\d+) recombined with giv at (\d+) as (.*)$/))) {
      const giv = givFor(Number(matched[1]));
      if (giv) giv.recombinedWith = { insn: Number(matched[2]), as: matched[3]!.trim() };
      else loop?.notes.push(trimmed);
      continue;
    }
    if ((matched = trimmed.match(/^giv at (\d+) derived from (\d+) as (.*)$/))) {
      const giv = givFor(Number(matched[1]));
      if (giv) giv.derivedFrom = { insn: Number(matched[2]), as: matched[3]!.trim() };
      else loop?.notes.push(trimmed);
      continue;
    }
    if ((matched = trimmed.match(/^giv at (\d+) reduced to (.*)$/))) {
      const giv = givFor(Number(matched[1]));
      if (giv) giv.reducedTo = matched[2]!.trim();
      else loop?.notes.push(trimmed);
      continue;
    }
    if ((matched = trimmed.match(/^giv of insn (\d+) not worth while, (-?\d+) vs (-?\d+)\.$/))) {
      const giv = givFor(Number(matched[1]));
      const rejected = { product: Number(matched[2]), insnCount: Number(matched[3]) };
      if (giv) giv.rejected = rejected;
      else loop?.notes.push(trimmed);
      continue;
    }
    if ((matched = trimmed.match(/^giv of insn (\d+): would need a multiply\.$/))) {
      const giv = givFor(Number(matched[1]));
      if (giv) giv.needsMultiply = true;
      else loop?.notes.push(trimmed);
      continue;
    }
    if (NOTE_PATTERNS.some((pattern) => pattern.test(trimmed))) {
      loop?.notes.push(trimmed);
      continue;
    }
    unrecognised.push({ line: lineNumber, text: trimmed });
  }

  passes.push(pass);
  const kept = passes.filter((record) => record.loops.length > 0);
  if (anyPhony) resolvePhonyCauses(kept.flatMap((record) => record.loops), rtl);
  return { functionName, passes: kept, unrecognised, rtlStartsAt };
}
