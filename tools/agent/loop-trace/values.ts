/** Small, conservative affine identities shared by target and trace joins. */
import { parseRtlInstructions } from "../compiler-trace/rtl-parser.js";

export interface LoopValue {
  base: "constant" | "stack" | "symbol";
  offset: number;
  symbol?: string;
}
export const constant = (offset: number): LoopValue => ({ base: "constant", offset });
export const valueKey = (value: LoopValue): string => JSON.stringify([value.base, value.symbol ?? "", value.offset]);
export function addValues(left: LoopValue | undefined, right: LoopValue | undefined): LoopValue | undefined {
  if (!left || !right) return undefined;
  if (left.base !== "constant" && right.base !== "constant") return undefined;
  const base = left.base === "constant" ? right : left;
  return { ...base, offset: left.offset + right.offset };
}

type Form = string | Form[];
function form(text: string): Form | undefined {
  const tokens = text.match(/"(?:\\.|[^"\\])*"|[^\s()]+|[()]/g) ?? [];
  let at = 0;
  const read = (): Form | undefined => {
    const token = tokens[at++];
    if (token !== "(") return token;
    const result: Form[] = [];
    while (at < tokens.length && tokens[at] !== ")") {
      const child = read();
      if (child === undefined) return undefined;
      result.push(child);
    }
    if (tokens[at++] !== ")") return undefined;
    return result;
  };
  return read();
}
export function rtlValue(text: string | undefined, registers: Map<number, LoopValue>): LoopValue | undefined {
  if (text === undefined) return undefined;
  const evaluate = (node: Form | undefined): LoopValue | undefined => {
    if (typeof node === "string") return Number.isFinite(Number(node)) ? constant(Number(node)) : undefined;
    if (!node) return undefined;
    const op = String(node[0]).split(":")[0]!.split("/")[0];
    if (op === "const_int") return evaluate(node[1]);
    if (op === "reg") {
      /* GCC's virtual stack-vars pointer in this target's pre-loop RTL. */
      if (node[1] === "1" && node[2] === "at") return { base: "stack", offset: 0 };
      return registers.get(Number(node[1]));
    }
    if (op === "symbol_ref" && Array.isArray(node[1]) && typeof node[1][0] === "string") {
      return { base: "symbol", symbol: JSON.parse(node[1][0]), offset: 0 };
    }
    if (op === "const") return evaluate(node[1]);
    if (op === "lo_sum") return evaluate(node[2]);
    if (op === "plus") return addValues(evaluate(node[1]), evaluate(node[2]));
    if (op === "mult") {
      const a = evaluate(node[1]); const b = evaluate(node[2]);
      return a?.base === "constant" && b?.base === "constant" ? constant(a.offset * b.offset) : undefined;
    }
    return undefined;
  };
  return evaluate(form(text));
}

export function rtlValues(dump: string): { byInsn: Map<number, LoopValue>; registers: Map<number, LoopValue> } {
  const insns = parseRtlInstructions(dump, "loop-values");
  const byInsn = new Map<number, LoopValue>();
  const registers = new Map<number, LoopValue>();
  const counts = new Map<number, number>();
  for (const insn of insns) for (const set of insn.sets) counts.set(set.register, (counts.get(set.register) ?? 0) + 1);
  /* Only single-SET registers are stable enough to substitute across blocks. */
  for (let round = 0; round <= insns.length; round++) {
    let changed = false;
    for (const insn of insns) {
      if (byInsn.has(insn.uid)) continue;
      const value = rtlValue(insn.expression, registers);
      if (!value) continue;
      byInsn.set(insn.uid, value);
      for (const set of insn.sets) if (counts.get(set.register) === 1) registers.set(set.register, value);
      changed = true;
    }
    if (!changed) break;
  }
  return { byInsn, registers };
}
