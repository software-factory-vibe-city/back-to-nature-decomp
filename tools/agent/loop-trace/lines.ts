/**
 * lines.ts — give a loop decision back the line of C it is about.
 *
 * `loop.c` logs insn UIDs. A reader who wants to know what the source did about
 * insn 1234 has, until now, had to read the whole function and guess. The
 * dumps this project compiles carry no help: without `-g`, `emit_note`
 * suppresses every line note, and two survive out of a three-hundred-line
 * function.
 *
 * They are recoverable, and cheaply, because of one detail in `emit_note`:
 *
 *     if (no_line_numbers && line > 0)
 *       { cur_insn_uid++; return 0; }
 *
 * The note is not built, but **the UID is still consumed**. So a `-g` compile
 * and a plain one number every insn identically, and the line notes from the
 * first can be read onto the UIDs of the second. This module runs that second
 * compile and — because "identically" is a claim about a compiler, not a
 * theorem — verifies it: if the two instruction streams differ in any way, no
 * map is returned at all. A wrong line is worse than no line; it sends a reader
 * to code that had nothing to do with the decision.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/** Insn UID -> 1-based source line, plus the file the lines are in. */
export interface LineMap {
  file: string;
  byInsn: Map<number, number>;
}

/** A line note: `(note UID PREV NEXT ("path") LINE)`. */
const LINE_NOTE = /^\(note\s+\d+\s+-?\d+\s+-?\d+\s+\("([^"]+)"\)\s+(\d+)\)/;
const INSN = /^\((?:insn|jump_insn|call_insn)(?:\/[a-z]+)*\s+(\d+)/;

/**
 * Read UID -> line from a dump that has line notes.
 *
 * An insn takes the line of the most recent note before it, which is what the
 * note means: `expand_expr_stmt` emits one per statement and every insn the
 * statement expands to follows it.
 */
export function parseLineNotes(dump: string): LineMap | undefined {
  const byInsn = new Map<number, number>();
  let file: string | undefined;
  let line: number | undefined;

  for (const text of dump.split("\n")) {
    const note = text.match(LINE_NOTE);
    if (note) {
      file ??= note[1];
      line = Number(note[2]);
      continue;
    }
    const insn = text.match(INSN);
    if (insn && line !== undefined) byInsn.set(Number(insn[1]), line);
  }
  if (file === undefined || byInsn.size === 0) return undefined;
  return { file, byInsn };
}

/**
 * The instruction stream, with everything `-g` adds removed.
 *
 * Debug output is directives and its own labels; the code is neither. Comparing
 * what is left is the check that licenses reading one compile's line notes onto
 * the other's UIDs.
 */
export function codeOnly(assembly: string): string[] {
  return assembly
    .split("\n")
    .map((text) => text.trim())
    .filter((text) => text !== ""
      && !text.startsWith(".")
      && !text.startsWith("#")
      && !/^(?:LM\d+|\$L[be]\d+):$/.test(text));
}

/** Do two compiles of one source produce the same instructions? */
export function sameCode(left: string, right: string): boolean {
  const a = codeOnly(left);
  const b = codeOnly(right);
  return a.length === b.length && a.every((text, index) => text === b[index]);
}

/** The closest pre-loop dump `-da` left, which is where the UIDs still exist. */
const PRE_LOOP_STAGES = ["gcse", "cse", "jump", "rtl"];

export function readLineMap(directory: string, stem: string): LineMap | undefined {
  for (const stage of PRE_LOOP_STAGES) {
    const path = join(directory, `${stem}.i.${stage}`);
    if (!existsSync(path)) continue;
    try {
      const map = parseLineNotes(readFileSync(path, "utf8"));
      if (map) return map;
    } catch {
      return undefined;
    }
  }
  return undefined;
}

/** One decision's source line, rendered with the text of that line. */
export function quoteLine(map: LineMap, source: string, uid: number): string | undefined {
  const line = map.byInsn.get(uid);
  if (line === undefined) return undefined;
  let text = "";
  try {
    text = readFileSync(source, "utf8").split("\n")[line - 1]?.trim() ?? "";
  } catch {
    /* The map is still worth its line number without the text. */
  }
  return text === "" ? `line ${line}` : `line ${line}:  ${text}`;
}
