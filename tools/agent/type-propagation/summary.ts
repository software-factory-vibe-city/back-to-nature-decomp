import type { MachineIrReport } from "../machine-ir/index.js";
import type { Summary, Relation, CallSite } from "./model.js";
import { REGISTER_COUNT } from "../machine-ir/ssa.js";

/** Exact address identity/bias; variable indexing is deliberately not equality. */
export function baseBias(report: MachineIrReport, value: number, active = new Set<number>()): { base: string; bias: number } | null {
  if (active.has(value) || active.size > 64) return null;
  const op = report.ir.values[value]?.op;
  const next = new Set(active).add(value);
  if (op?.kind === "const") return { base: "absolute", bias: op.value >>> 0 };
  if (op?.kind === "entry") return { base: `entry:${op.register}`, bias: 0 };
  if (op?.kind === "binary" && (op.op === "add" || op.op === "sub")) {
    const right = report.ir.values[op.right]?.op;
    if (right?.kind === "const") {
      const p = baseBias(report, op.left, next);
      return p && { base: p.base, bias: p.bias + (op.op === "add" ? 1 : -1) * (right.value | 0) };
    }
  }
  if (op?.kind === "phi") {
    const inputs = op.inputs.filter((id) => id !== value).map((id) => baseBias(report, id, next));
    const first = inputs[0];
    if (first && inputs.every((p) => p && p.base === first.base && p.bias === first.bias)) return first;
  }
  return null;
}

/** Resolve only a dominating, exact-width store in the same memory chain.
 * Calls/opaque writes and possibly aliasing writes stop the proof. Distinct
 * offsets in one base web and disjoint absolute ranges can be skipped safely. */
export function storedValue(report: MachineIrReport, memory: number, address: number, width: number, active = new Set<number>()): number | null {
  if (active.has(memory) || active.size > 128) return null;
  const version = report.ir.memory[memory]?.op;
  if (!version) return null;
  const next = new Set(active).add(memory);
  if (version.kind === "phi") {
    const inputs = version.inputs.filter((m) => m !== memory).map((m) => storedValue(report, m, address, width, next));
    return inputs.length && inputs[0] !== null && inputs.every((v) => v === inputs[0]) ? inputs[0]! : null;
  }
  if (version.kind !== "store") return null;
  const effect = report.ir.effects[version.effect];
  if (effect?.op.kind !== "store") return null;
  const a = baseBias(report, address), b = baseBias(report, effect.op.address);
  if (address === effect.op.address && width === effect.op.width) return effect.op.value;
  if (a && b && a.base === b.base) {
    if (a.bias === b.bias && width === effect.op.width) return effect.op.value;
    if (a.bias + width <= b.bias || b.bias + effect.op.width <= a.bias)
      return storedValue(report, version.from, address, width, next);
  }
  return null;
}

export function localSummary(report: MachineIrReport): { summary: Summary; relations: Relation[] } {
  const id = `${report.containerId}:${report.functionName}`;
  const relation = (from: number, to: number, rule: Relation["rule"], witness: string): Relation => ({
    id: `${id}:${rule}:${from}:${to}`, from: { function: id, value: from }, to: { function: id, value: to }, rule, witness,
  });
  const relations: Relation[] = [];
  const slots: Summary["slots"] = [];
  const used = new Set<number>();
  for (const value of report.ir.values) {
    const op = value.op;
    if (op.kind === "load") { used.add(op.address); }
    else if (op.kind === "binary") { used.add(op.left); used.add(op.right); }
    else if (op.kind === "unary") used.add(op.operand);
    /* A phi is not a read. Dead register phis must not manufacture arguments. */
  }
  for (const effect of report.ir.effects) {
    if (effect.op.kind === "store") { used.add(effect.op.address); used.add(effect.op.value); }
    if (effect.op.kind === "call" && effect.op.through !== undefined) used.add(effect.op.through);
  }
  for (const exit of report.ir.blockExit) {
    if (exit.kind === "return" && exit.value !== null) used.add(exit.value);
    if (exit.kind === "branch") used.add(exit.condition);
    if (exit.kind === "dispatch") used.add(exit.index);
  }
  /* Follow only already-live expression/phi operands. */
  for (let changed = true; changed;) {
    changed = false;
    for (const id of [...used]) {
      const op = report.ir.values[id]?.op;
      const inputs = op?.kind === "phi" ? op.inputs : op?.kind === "binary" ? [op.left, op.right] : op?.kind === "unary" ? [op.operand] : [];
      for (const input of inputs) if (!used.has(input)) { used.add(input); changed = true; }
    }
  }
  /* Incoming stack words: expressed relative to ENTRY sp, never inferred from
     frame size or confused with the outgoing area of the current frame. */
  for (const value of report.ir.values) {
    const op = value.op;
    if (op.kind === "entry" && /^a[0-3]$/.test(op.register))
      slots.push({ slot: Number(op.register.slice(1)), value: value.id, used: used.has(value.id) });
    if (op.kind === "load") {
      const address = baseBias(report, op.address);
      if (address?.base === "entry:sp" && address.bias >= 16 && address.bias % 4 === 0)
        slots.push({ slot: address.bias / 4, value: value.id, used: used.has(value.id), width: op.width, signed: op.signed });
      const stored = storedValue(report, op.memory, op.address, op.width);
      if (stored !== null) relations.push(relation(stored, value.id, "memory", `load at 0x${value.vram?.toString(16)} from m${op.memory}; exact dominating store`));
    }
    if (op.kind === "phi") for (const input of op.inputs.filter((v) => v !== value.id))
      relations.push(relation(input, value.id, "phi-input", `B${op.block} phi v${value.id}`));
    /* Other expressions are not source-type equality (casts/interior pointers).
       Zero-offset copies were already interned by the lifter. */
  }
  const calls: CallSite[] = report.ir.effects.filter((e) => e.op.kind === "call").map((effect) => {
    if (effect.op.kind !== "call") throw new Error("not a call");
    const args = [...effect.op.args];
    const memory = effect.op.memory;
    const sp = report.ir.values.find((v) => {
      const address = baseBias(report, v.id);
      return address?.base === "entry:sp" && address.bias === -frameBias(report, effect.block);
    });
    /* Search the pre-call memory chain for outgoing slot stores; saved registers
       outside the outgoing area are not arguments. Only slots needed by a
       witnessed callee are consumed by the graph builder. */
    if (memory !== undefined && sp) {
      const stack = baseBias(report, sp.id)!;
      for (let slot = 4; slot < 32; slot++) {
        const address = report.ir.values.find((v) => {
          const p = baseBias(report, v.id); return p?.base === stack.base && p.bias === stack.bias + slot * 4;
        });
        args[slot] = address ? storedValue(report, memory, address.id, 4) : null;
      }
    }
    return { id: `${id}:call:${effect.vram}`, caller: id, at: effect.vram, effect: effect.id,
      kind: effect.op.target === undefined ? "indirect" : "direct", targets: [], closed: false, remainder: [], args,
      results: report.ir.values.filter((v) => v.op.kind === "call-result" && v.op.effect === effect.id && v.op.register === "v0").map((v) => v.id),
      ...(effect.op.through === undefined ? {} : { through: effect.op.through }) };
  });
  /* External j is a tail transfer, not an intra-function jump. Indirect jr is
     handled by the graph as unresolved rather than silently classified as ra. */
  for (const block of report.ir.cfg.blocks) {
    const instruction = block.terminatorIndex === undefined ? undefined : report.ir.cfg.insns[block.terminatorIndex];
    if (!instruction || instruction.op !== "j" || instruction.target === undefined ||
      (instruction.target >= report.vram && instruction.target < report.vram + report.sizeBytes)) continue;
    calls.push({ id: `${id}:tail:${instruction.vram}`, caller: id, at: instruction.vram, effect: -1, kind: "tail",
      targets: [], closed: false, remainder: [], args: [4, 5, 6, 7].map((r) => report.ir.blockOut[block.index * REGISTER_COUNT + r] ?? null), results: [] });
  }
  const returns = report.ir.blockExit.flatMap((exit, block) => {
    const b = report.ir.cfg.blocks[block]!;
    const insn = b.terminatorIndex === undefined ? undefined : report.ir.cfg.insns[b.terminatorIndex];
    return exit.kind === "return" && insn?.op === "jr" && insn.rs === 31 && exit.value !== null ? [exit.value] : [];
  });
  return { summary: { id, name: report.functionName, container: report.containerId, report, slots, returns: [...new Set(returns)], calls }, relations };
}

function frameBias(report: MachineIrReport, block: number): number {
  const sp = report.ir.blockIn[block * REGISTER_COUNT + 29];
  const p = sp === undefined ? null : baseBias(report, sp);
  /* In a single-entry block the prologue may be inside the block. */
  if (p?.bias) return -p.bias;
  const prologue = report.ir.cfg.insns.find((i) => i.op === "addiu" && i.rs === 29 && i.rt === 29 && i.simm < 0);
  return prologue ? -prologue.simm : 0;
}
