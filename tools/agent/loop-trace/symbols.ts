/**
 * symbols.ts — give the loop log's insn UIDs their names back.
 *
 * `loop.c` logs decisions about insn UIDs and pseudo registers: `Insn 1225:
 * regno 523 (life 2), move-insn savings 2 moved to 1647`. Which address that
 * is, the log never says — and "which address" is the whole question when a
 * residual is one hoist in the wrong place. Three sessions read those UIDs by
 * cross-referencing dumps by hand.
 *
 * The `.loop` dump's own RTL is written *after* both passes, so the moved insns
 * are gone from it by the time it is printed. The dump from the pass *before*
 * loop still has them, under the same UIDs — UIDs are stable for insns that
 * already exist — so that is what this reads. `-da` writes every stage, so it
 * costs no extra compile.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/** Stages before `loop`, newest first: the first one present is the closest. */
const PRE_LOOP_STAGES = ["gcse", "cse", "jump", "rtl"];

export interface RtlFacts {
  /** Insn UID -> symbols its pattern references. */
  symbolsByInsn: Map<number, string[]>;
  /** Pseudo register -> symbols it is set from. */
  symbolsByRegister: Map<number, string[]>;
  /** Which dump these came from, for the report's provenance. */
  stage?: string;
}

const EMPTY: RtlFacts = { symbolsByInsn: new Map(), symbolsByRegister: new Map() };

function parenBalance(text: string): number {
  let depth = 0;
  for (const character of text) {
    if (character === "(") depth++;
    else if (character === ")") depth--;
  }
  return depth;
}

/** Split a dump into whole top-level `(insn ...)` expressions. */
function topLevelExpressions(dump: string): string[] {
  const lines = dump.split("\n");
  const expressions: string[] = [];
  for (let index = 0; index < lines.length; index++) {
    if (!/^\((?:insn|jump_insn|call_insn)\b/.test(lines[index]!)) continue;
    let text = lines[index]!;
    let depth = parenBalance(text);
    while (depth > 0 && index + 1 < lines.length) {
      index++;
      text += ` ${lines[index]!.trim()}`;
      depth += parenBalance(lines[index]!);
    }
    expressions.push(text);
  }
  return expressions;
}

export function parseRtlFacts(dump: string, stage?: string): RtlFacts {
  const symbolsByInsn = new Map<number, string[]>();
  const symbolsByRegister = new Map<number, string[]>();

  for (const expression of topLevelExpressions(dump)) {
    const uid = Number(expression.match(/^\((?:insn|jump_insn|call_insn)(?:\/[a-z]+)*\s+(\d+)/)?.[1]);
    if (!Number.isFinite(uid)) continue;
    const symbols = [...new Set([...expression.matchAll(/symbol_ref:[A-Z]+\s+\("([^"]+)"\)/g)].map((match) => match[1]!))];
    if (symbols.length === 0) continue;
    symbolsByInsn.set(uid, symbols);

    /* `(set (reg:SI N) ...)` — the pseudo this insn defines, so a decision that
       names only a regno can still be resolved. */
    const destination = Number(expression.match(/\(set\s+\(reg[^\s]*\s+(\d+)\)/)?.[1]);
    if (!Number.isFinite(destination)) continue;
    const existing = symbolsByRegister.get(destination) ?? [];
    symbolsByRegister.set(destination, [...new Set([...existing, ...symbols])]);
  }
  const facts: RtlFacts = { symbolsByInsn, symbolsByRegister };
  if (stage !== undefined) facts.stage = stage;
  return facts;
}

/**
 * Read the closest pre-loop dump `-da` left in a directory.
 *
 * Returns empty facts rather than throwing: a symbol name is an aid to reading
 * the report, never something a decision depends on, so its absence must not
 * take the report down with it.
 */
export function readRtlFacts(directory: string, stem: string): RtlFacts {
  for (const stage of PRE_LOOP_STAGES) {
    const path = join(directory, `${stem}.i.${stage}`);
    if (!existsSync(path)) continue;
    try {
      return parseRtlFacts(readFileSync(path, "utf8"), stage);
    } catch {
      return EMPTY;
    }
  }
  return EMPTY;
}

/** The best name for a decision that names an insn and a register.
 *
 * Several symbols are joined with a comma rather than a plus: a plus is how the
 * target lift renders "this many bytes past the nearest known symbol", and one
 * spelling meaning two things is how a comparison silently succeeds. */
export function nameFor(facts: RtlFacts, insn: number, regno?: number): string | undefined {
  const byInsn = facts.symbolsByInsn.get(insn);
  if (byInsn && byInsn.length > 0) return byInsn.join(",");
  if (regno === undefined) return undefined;
  const byRegister = facts.symbolsByRegister.get(regno);
  return byRegister && byRegister.length > 0 ? byRegister.join(",") : undefined;
}
