import { decodeWord, isBranch, isLoad, type DecodedInsn } from "../matching-reconstruction/decode.ts";
import { buildCfg } from "../machine-ir/cfg.ts";
import { liftToSsa } from "../machine-ir/ssa.ts";
import type { ValueOp } from "../machine-ir/ir.ts";
import { parseExe } from "./formats.ts";
import type { Limits } from "./types.ts";

/** One narrow, completely checked decoder constructor. This is a static
 * relation recognizer, not an interpreter of an arbitrary game routine. */
export function recognizeByteTransform(insns: DecodedInsn[]): { kind: "byte-xor"; key: number; parameters: string[]; conditions: string[] } | undefined {
  if (insns.length !== 11) return undefined;
  const [guard, guardSlot, load, step, xor, store, count, loop, outStep, ret, retSlot] = insns as [DecodedInsn, DecodedInsn, DecodedInsn, DecodedInsn, DecodedInsn, DecodedInsn, DecodedInsn, DecodedInsn, DecodedInsn, DecodedInsn, DecodedInsn];
  if (guard.op !== "beq" || guard.rs !== 6 || guard.rt !== 0 || guard.target !== ret.vram || guardSlot.op !== "nop") return undefined;
  if (load.op !== "lbu" || load.rs !== 4 || load.simm !== 0 || load.rt < 8 || load.rt > 15) return undefined;
  if (step.op !== "addiu" || step.rs !== 4 || step.rt !== 4 || step.simm !== 1) return undefined;
  if (xor.op !== "xori" || xor.rs !== load.rt || xor.rt !== load.rt) return undefined;
  if (store.op !== "sb" || store.rs !== 5 || store.rt !== load.rt || store.simm !== 0) return undefined;
  if (count.op !== "addiu" || count.rs !== 6 || count.rt !== 6 || count.simm !== -1) return undefined;
  if (loop.op !== "bne" || loop.rs !== 6 || loop.rt !== 0 || loop.target !== load.vram) return undefined;
  if (outStep.op !== "addiu" || outStep.rs !== 5 || outStep.rt !== 5 || outStep.simm !== 1 || ret.op !== "jr" || ret.rs !== 31 || retSlot.op !== "nop") return undefined;
  return { kind: "byte-xor", key: xor.uimm & 255, parameters: ["a0:input", "a1:output", "a2:count"], conditions: ["count is the requested input extent", "separate output buffer", "all input bytes mapped", "byte store truncates xori to 8 bits"] };
}
export function transformAt(bytes: Buffer, address: number): ReturnType<typeof recognizeByteTransform> {
  const image = parseExe(bytes);
  if (!image || !Number.isSafeInteger(address) || address % 4 || address < image.load || address + 44 > image.load + image.length) return undefined;
  const insns = Array.from({ length: 11 }, (_, i) => decodeWord(bytes.readUInt32LE(image.offset + address - image.load + i * 4), address + i * 4));
  return recognizeByteTransform(insns);
}
export function evaluateByteTransform(bytes: Buffer, key: number, maximum: number): Buffer {
  if (!Number.isInteger(key) || key < 0 || key > 255) throw new Error("Invalid byte-xor key");
  if (bytes.length > maximum) throw new Error("budget-exhausted: transform output");
  return Buffer.from(bytes.map(byte => byte ^ key));
}

interface Affine { base: number; terms: Record<string, number> }
export interface StaticReport {
  outcome: "candidate" | "unsupported" | "context-unresolved" | "budget-exhausted";
  container: string; image?: ReturnType<typeof parseExe>;
  functions: Array<Record<string, unknown>>;
  blockers: string[];
  capability: string;
}
export async function analyzeOriginal(bytes: Buffer, container: string, limits: Limits, signal?: AbortSignal): Promise<StaticReport> {
  const report: StaticReport = { outcome: "candidate", container, functions: [], blockers: [], capability: "PS-X EXE entry/direct-call CFG and SSA slices; field observations, not resource-operation signatures" };
  let image: ReturnType<typeof parseExe>;
  try { image = parseExe(bytes); } catch (error) { return { ...report, outcome: "unsupported", blockers: [String(error)] }; }
  if (!image) return { ...report, outcome: "context-unresolved", blockers: ["No validated executable address map; overlay load address/entry or data interpretation is unresolved"] };
  report.image = image;
  const mapped = (address: number): boolean => address % 4 === 0 && address >= image!.load && address + 4 <= image!.load + image!.length;
  const decode = (address: number): DecodedInsn => decodeWord(bytes.readUInt32LE(image!.offset + address - image!.load), address);
  const pending = [image.entry], seen = new Set<number>();
  while (pending.length) {
    signal?.throwIfAborted();
    if (seen.size >= limits.maxFunctions) { report.outcome = "budget-exhausted"; report.blockers.push("Direct-call function budget; raise maxFunctions"); break; }
    const entry = pending.shift()!;
    if (seen.has(entry)) continue;
    seen.add(entry);
    if (!mapped(entry)) { report.blockers.push(`Unmapped direct call target 0x${entry.toString(16)}`); continue; }
    const work = [entry], reached = new Map<number, DecodedInsn>(), localBlockers: string[] = [];
    while (work.length) {
      const pc = work.pop()!;
      if (reached.has(pc)) continue;
      if (reached.size >= limits.maxInstructions) { localBlockers.push("Instruction budget; function slice incomplete"); break; }
      if (!mapped(pc)) { localBlockers.push(`Unmapped control edge 0x${pc.toString(16)}`); continue; }
      const insn = decode(pc);
      reached.set(pc, insn);
      if (insn.op === "unknown" || insn.op === "break") { localBlockers.push(`Opaque/trapping instruction at 0x${pc.toString(16)}`); continue; }
      const transfer = isBranch(insn.op) || ["j", "jal", "jr", "jalr"].includes(insn.op);
      if (transfer) {
        if (!mapped(pc + 4)) { localBlockers.push("Missing transfer delay slot"); continue; }
        const slot = decode(pc + 4);
        reached.set(pc + 4, slot);
        if (isBranch(slot.op) || ["j", "jal", "jr", "jalr", "unknown"].includes(slot.op)) { localBlockers.push("Unsupported instruction in transfer delay slot"); continue; }
      }
      if (isBranch(insn.op)) work.push(insn.target!, pc + 8);
      else if (insn.op === "j") work.push(insn.target!);
      else if (insn.op === "jr") { if (insn.rs !== 31) localBlockers.push(`Unresolved indirect jump at 0x${pc.toString(16)}`); }
      else if (insn.op === "jal" || insn.op === "jalr") {
        if (insn.op === "jal") pending.push(insn.target!);
        else localBlockers.push(`Unresolved indirect call at 0x${pc.toString(16)}`);
        work.push(pc + 8);
      } else work.push(pc + 4);
    }
    const addresses = [...reached.keys()].sort((a, b) => a - b);
    if (!addresses.length) continue;
    const first = addresses[0]!, last = addresses[addresses.length - 1]!;
    // Never manufacture an enormous dense span around an external tail jump.
    if (first !== entry || (last - first) / 4 >= limits.maxInstructions || localBlockers.length) {
      report.functions.push({ entry, outcome: "context-unresolved", addresses, blockers: localBlockers.length ? localBlockers : ["Non-contiguous/tail-call span requires an interprocedural adapter"] });
      continue;
    }
    const insns: DecodedInsn[] = [];
    for (let pc = first; pc <= last; pc += 4) insns.push(decode(pc));
    const cfg = buildCfg(insns), ir = liftToSsa(`resource_${entry.toString(16)}`, cfg, { ...(image.gp ? { gpValue: image.gp } : {}) });
    const affineMemo = new Map<number, Affine | undefined>();
    function affine(value: number, visiting = new Set<number>()): Affine | undefined {
      if (visiting.has(value)) return undefined;
      if (affineMemo.has(value)) return affineMemo.get(value);
      visiting.add(value);
      const op: ValueOp = ir.values[value]!.op;
      let result: Affine | undefined;
      if (op.kind === "const") result = { base: op.value, terms: {} };
      if (op.kind === "entry") result = { base: 0, terms: { [op.register]: 1 } };
      if (op.kind === "binary") {
        const left = affine(op.left, new Set(visiting)), right = affine(op.right, new Set(visiting));
        if (left && right) {
          if (op.op === "add" || op.op === "sub") {
            const sign = op.op === "add" ? 1 : -1;
            const terms = { ...left.terms };
            for (const [key, value] of Object.entries(right.terms)) terms[key] = (terms[key] ?? 0) + sign * value;
            result = { base: (left.base + sign * right.base) >>> 0, terms };
          } else if ((op.op === "sll" || op.op === "mulLo") && !Object.keys(right.terms).length) {
            const factor = op.op === "sll" ? 2 ** (right.base & 31) : right.base;
            result = { base: (left.base * factor) >>> 0, terms: Object.fromEntries(Object.entries(left.terms).map(([key, value]) => [key, value * factor])) };
          }
        }
      }
      affineMemo.set(value, result);
      return result;
    }
    const fields = ir.values.filter(v => v.op.kind === "load").map(v => {
      const op = v.op as Extract<ValueOp, { kind: "load" }>;
      return { value: v.id, address: v.vram, width: op.width, signed: op.signed, affineAddress: affine(op.address) ?? null, memoryVersion: op.memory };
    });
    function slice(root: number): number[] {
      const out = new Set<number>(), todo = [root];
      while (todo.length) {
        const value = todo.pop()!;
        if (out.has(value)) continue;
        out.add(value);
        const op = ir.values[value]!.op;
        if (op.kind === "binary") todo.push(op.left, op.right);
        if (op.kind === "unary") todo.push(op.operand);
        if (op.kind === "load") todo.push(op.address);
        if (op.kind === "phi") todo.push(...op.inputs.filter(v => v >= 0));
      }
      return [...out].sort((a, b) => a - b);
    }
    const calls = ir.effects.filter(e => e.op.kind === "call").map(e => {
      const op = e.op as Extract<typeof e.op, { kind: "call" }>;
      return { address: e.vram, target: op.target ?? null, args: op.args.map(v => v === null ? null : { value: v, slice: slice(v) }), outcome: "context-unresolved", reason: "Callee operation semantics have not been independently witnessed" };
    });
    const transform = addresses.length === insns.length ? recognizeByteTransform(insns) : undefined;
    report.functions.push({ entry, outcome: "candidate", addresses, blocks: cfg.blocks, fields, calls,
      values: ir.values, memory: ir.memory, effects: ir.effects, opaque: ir.opaque,
      ...(transform ? { transform: { ...transform, outcome: "validated", evidence: "Entire supported constructor checked against original words including load and branch delay slots" } } : {}),
      limitations: ["SSA slices are analytical; MIPS load-delay/overflow/ABI assumptions require auditing before decoder lowering", "No automatic archive origin/count or GPU/SPU semantic inference from these observations"] });
    await new Promise<void>(r => setImmediate(r));
  }
  return report;
}
