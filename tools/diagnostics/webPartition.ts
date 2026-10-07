/** Same-value register partitions over ORIGINAL words. No source or compiler
 * dependency. Reaching definitions are solved over the CFG (including delay
 * slots); a copy keeps value identity but opens a separate residence/web.
 * Joins, aliasing, opaque instructions and cycles never acquire guessed values.
 */
import { createHash } from "node:crypto";
import { buildCfg } from "../agent/machine-ir/cfg.js";
import { computeDominators } from "../agent/machine-ir/dominance.js";
import { buildRegions } from "../agent/machine-ir/regions.js";
import { decodeBytes } from "../agent/matching-reconstruction/exec.js";
import { definedRegister, isLoad, isStore, isBranch, loadWidth, loadSigned, REGISTER_NAMES, type DecodedInsn } from "../agent/matching-reconstruction/decode.js";

export interface ValueIdentity {
  key: string;
  kind: "constant" | "entry" | "symbol-high" | "address" | "load" | "call-result" | "derived";
  description: string;
  memory?: { addressKey: string; address: number | null; width: 1 | 2 | 4; signed: boolean };
}
export interface Residence { register: string; birth: number; lastRead: number; definitions: number[]; reads: number[]; acrossCalls: number[] }
export interface ValueTransition { at: number; operation: string; output: string; inputs: string[] }
export interface CopyEdge { at: number; from: string; to: string; delaySlot: boolean; rematerialized: boolean }
export interface Web {
  id: string;
  identity: ValueIdentity | null;
  identities: ValueIdentity[];
  status: "proven" | "undetermined";
  residences: Residence[];
  birth: number;
  /** Identity at the first binding can be proven even when the web later
   * becomes loop-carried and no single whole-web identity is provable. */
  birthValue: ValueIdentity | null;
  death: number;
  readCount: number;
  liveLength: number;
  /** Machine operands + definitions, weighted by natural-loop depth. This is
   * NOT REG_N_REFS: phantom RTL operands and allocator-private state are absent. */
  estimatedWeightedReferences: number;
  entry: boolean;
  rematerializations: number[];
  evidence: string[];
}
export interface WebPartition {
  schemaVersion: 1;
  functionName: string;
  side: "target" | "candidate";
  byteHash: string;
  instructionCount: number;
  machine: { vram: number; words: number[] };
  webs: Web[];
  copies: CopyEdge[];
  transitions: ValueTransition[];
  deadWrites: Array<{ register: string; at: number; identity: ValueIdentity | null }>;
  caveats: string[];
}
export interface PartitionInput {
  functionName: string; bytes: Buffer; vram: number; side?: "target" | "candidate";
  gp?: number;
  /** Optional exact address names; identity is always numeric, never a nearest
   * symbol guess. LUI alone proves only its high value, not a full symbol. */
  symbols?: ReadonlyMap<number, string>;
  resolveDispatch?: (instructionIndex: number) => number[] | undefined;
}
interface Term { op: string; args?: number[][]; value?: number | undefined; detail?: string | undefined }
interface Node { id: number; register: string; at: number; term: Term; reads: number[]; depth: number; remat: boolean }
interface Event { at: number; reads: string[]; writes: Array<{ register: string; op: string; inputs?: string[]; value?: number; detail?: string; remat?: boolean }>; copy?: { from: string; to: string; remat: boolean }; depth: number }
const FIXED = new Set(["zero", "at", "sp", "gp", "fp", "ra", "hi", "lo", "k0", "k1"]);
const CLOBBER = ["v0", "v1", "a0", "a1", "a2", "a3", "t0", "t1", "t2", "t3", "t4", "t5", "t6", "t7", "t8", "t9"];
const digest = (s: string): string => createHash("sha256").update(s).digest("hex").slice(0, 24);
const constant = (n: number, kind: ValueIdentity["kind"] = "constant", label?: string): ValueIdentity => ({ key: `const:${n >>> 0}`, kind, description: label ?? `0x${(n >>> 0).toString(16)}` });

/** Fold only exact 32-bit integer operations. */
export function expressionIdentity(op: string, args: ValueIdentity[], immediate?: number): ValueIdentity | null {
  const nums = args.map(a => /^const:(\d+)$/.exec(a.key)).map(m => m ? Number(m[1]) : undefined);
  const a = nums[0], b = immediate ?? nums[1];
  if (a !== undefined && b !== undefined) {
    let n: number | undefined;
    switch (op) {
      case "add": n = a + b; break; case "sub": n = a - b; break;
      case "and": n = a & b; break; case "or": n = a | b; break; case "xor": n = a ^ b; break;
      case "sll": n = a << (b & 31); break; case "srl": n = a >>> (b & 31); break; case "sra": n = (a | 0) >> (b & 31); break;
      case "slt": n = (a | 0) < (b | 0) ? 1 : 0; break; case "sltu": n = (a >>> 0) < (b >>> 0) ? 1 : 0; break;
    }
    if (n !== undefined) return constant(n);
  }
  if (["add", "or", "xor"].includes(op) && b === 0) return args[0] ?? null;
  if (["add", "or", "xor"].includes(op) && a === 0 && args[1]) return args[1];
  const keys = [...args.map(x => x.key), ...(immediate === undefined ? [] : [`const:${immediate >>> 0}`])];
  if (["add", "and", "or", "xor"].includes(op)) keys.sort();
  return { key: `${op}:${digest(keys.join("|"))}`, kind: "derived", description: `${op}(${args.map(x => x.description).join(",")}${immediate === undefined ? "" : `,${immediate}`})`.slice(0, 240) };
}

function operands(i: DecodedInsn): number[] {
  if (isLoad(i.op)) return [i.rs];
  if (["sllv", "srlv", "srav"].includes(i.op)) return [i.rt, i.rs];
  if (isStore(i.op)) return [i.rt, i.rs];
  if (["sll", "srl", "sra"].includes(i.op)) return [i.rt];
  if (i.op === "lui" || i.op === "nop" || i.op === "j" || i.op === "jal" || i.op === "break") return [];
  if (i.op === "mfhi" || i.op === "mflo") return [];
  if (i.op === "jr" || i.op === "jalr") return [i.rs];
  if (["beq", "bne"].includes(i.op)) return [i.rs, i.rt];
  if (isBranch(i.op) || ["addiu", "addi", "andi", "ori", "xori", "slti", "sltiu"].includes(i.op)) return [i.rs];
  return [i.rs, i.rt];
}

export function extractWebPartition(input: PartitionInput): WebPartition {
  if (!Number.isSafeInteger(input.vram) || input.vram < 0 || input.vram + input.bytes.length > 0x100000000 || input.vram % 4 || input.bytes.length % 4) throw new Error("unaligned web-partition input");
  const insns = decodeBytes(input.bytes, input.vram);
  const caveats: string[] = ["Machine read counts and live lengths are observations/approximations, not allocator REG_N_REFS or live lengths."];
  if (!insns.length) return { schemaVersion: 1, functionName: input.functionName, side: input.side ?? "target", byteHash: createHash("sha256").update(input.bytes).digest("hex"), instructionCount: 0, machine: { vram: input.vram, words: [] }, webs: [], copies: [], transitions: [], deadWrites: [], caveats };
  const cfg = buildCfg(insns, { resolveDispatch: input.resolveDispatch });
  const regions = buildRegions(cfg, computeDominators(cfg));
  const depths = insns.map((_, at) => regions.loops.filter(l => l.body.has(cfg.blockOf[at]!)).length);
  const events = new Map<number, Event[]>();
  // Stack slots are usable only with one conventional prologue/epilogue SP
  // adjustment. Nonstandard stack motion makes all reload identities unknown.
  const spWrites = insns.filter(i => definedRegister(i) === 29);
  const stackSafe = spWrites.every(i => i.op === "addiu" && i.rs === 29) && spWrites.length <= 2;
  if (!stackSafe) caveats.push("Nonstandard stack motion: stack-slot reload identity is undetermined.");
  const slots = [...new Set(insns.filter(i => (isLoad(i.op) || isStore(i.op)) && i.rs === 29).map(i => i.simm))];
  const callOrdinals = new Map<number, number>();
  let ordinal = 0;
  insns.forEach((i, at) => { if (i.op === "jal" || i.op === "jalr") callOrdinals.set(at, ordinal++); });
  const delaySlots = new Set<number>();
  insns.forEach((i, at) => { if (isBranch(i.op) || ["j", "jr", "jal", "jalr"].includes(i.op)) delaySlots.add(at + 1); });
  for (const block of cfg.blocks) {
    const es: Event[] = [];
    for (const at of block.instructions) {
      const i = insns[at]!, regs = operands(i).map(r => REGISTER_NAMES[r]!).filter(r => r !== "zero");
      const previous = insns[at - 1];
      const loadHazard = previous && isLoad(previous.op) && previous.rt !== 0 && operands(i).includes(previous.rt);
      const e: Event = { at, reads: regs, writes: [], depth: depths[at]! };
      const dest = definedRegister(i);
      const rs = REGISTER_NAMES[i.rs]!, rt = REGISTER_NAMES[i.rt]!;
      if (loadHazard || dest === "unknown" || i.op === "lwl" || i.op === "lwr" || i.op === "swl" || i.op === "swr") {
        caveats.push(`${loadHazard ? "R3000 load-delay read" : "Opaque/unaligned word"} at 0x${i.vram.toString(16)}: dependent identities are undetermined.`);
        e.reads = [];
        e.writes = [...REGISTER_NAMES.filter(r => r !== "zero"), "hi", "lo", "memory", ...slots.map(s => `slot:${s}`)].map(register => ({ register, op: "unknown" }));
      } else if (i.op !== "jal" && i.op !== "jalr" && dest !== null) {
        const register = REGISTER_NAMES[dest]!;
        const copy = (i.op === "addu" || i.op === "or") && (i.rs === 0 || i.rt === 0);
        if (copy) {
          const from = i.rs === 0 ? rt : rs;
          e.writes.push({ register, op: "copy", inputs: [from], remat: from === "zero" });
          e.copy = { from, to: register, remat: from === "zero" };
        } else if (i.op === "lui") e.writes.push({ register, op: "high", value: (i.uimm << 16) >>> 0, remat: true });
        else if (isLoad(i.op)) {
          const slot = stackSafe && i.rs === 29 && i.op === "lw";
          e.writes.push({ register, op: slot ? "slot-load" : `load:${i.op}`, inputs: slot ? [`slot:${i.simm}`] : [rs, "memory"], value: i.simm, remat: slot });
        } else if (i.op === "mfhi" || i.op === "mflo") {
          const from = i.op === "mfhi" ? "hi" : "lo";
          e.reads.push(from); e.writes.push({ register, op: "copy", inputs: [from] });
        } else {
          const op = ({ addu: "add", addi: "add", addiu: "add", subu: "sub", andi: "and", ori: "or", xori: "xor", slti: "slt", sltiu: "sltu", sllv: "sll", srlv: "srl", srav: "sra" } as Record<string, string>)[i.op] ?? i.op;
          const shift = ["sll", "srl", "sra"].includes(i.op);
          const imm = ["addi", "addiu", "andi", "ori", "xori", "slti", "sltiu"].includes(i.op);
          e.writes.push({ register, op, inputs: shift ? [rt] : imm ? [rs] : ["sllv", "srlv", "srav"].includes(i.op) ? [rt, rs] : [rs, rt], ...(shift ? { value: i.shamt } : imm ? { value: ["andi", "ori", "xori"].includes(i.op) ? i.uimm : i.simm } : {}) });
        }
      }
      if (["mult", "multu", "div", "divu"].includes(i.op)) e.writes.push(...["hi", "lo"].map(register => ({ register, op: `${i.op}:${register}`, inputs: [rs, rt] })));
      if (dest === 29) e.writes.push(...slots.map(s => ({ register: `slot:${s}`, op: "unknown" })));
      if (isStore(i.op)) {
        e.writes.push({ register: "memory", op: "memory", detail: `store:${at}` });
        if (stackSafe && i.rs === 29) {
          // Overlapping narrow stores invalidate the whole word; no invented
          // little-endian subfield reconstruction here.
          for (const s of slots) if (Math.abs(s - i.simm) < 4) e.writes.push({ register: `slot:${s}`, op: i.op === "sw" && s === i.simm ? "copy" : "unknown", inputs: [rt] });
        } else e.writes.push(...slots.map(s => ({ register: `slot:${s}`, op: "unknown" })));
      }
      es.push(e);
      // Call effects occur AFTER its slot, even when the slot sets an argument
      // or copies the old return register. No target arity is guessed.
      const call = insns[at - 1];
      if (call && (call.op === "jal" || call.op === "jalr")) {
        const detail = `${call.target === undefined ? "indirect" : call.target}:${callOrdinals.get(at - 1)}`;
        es.push({ at, reads: [], depth: depths[at]!, writes: [
          ...[...CLOBBER, "hi", "lo"].map(register => ({ register, op: register === "v0" || register === "v1" ? "call-result" : "unknown", detail: `${detail}:${register}` })),
          { register: "memory", op: "memory", detail: `call:${detail}` },
          ...slots.map(s => ({ register: `slot:${s}`, op: "unknown" })),
        ] });
      }
    }
    events.set(block.index, es);
  }
  if (cfg.blocks.some(b => b.instructions.some(at => insns[at]!.op === "jr" && insns[at]!.rs !== 31)) && !input.resolveDispatch) caveats.push("Indirect dispatch unresolved: successor webs are not proven.");
  const nodes: Node[] = [], entries = new Map<string, number>(), writeIds = new Map<Event, number[]>();
  const entry = (r: string): number => {
    if (!entries.has(r)) { entries.set(r, nodes.length); nodes.push({ id: nodes.length, register: r, at: -1, term: r === "zero" ? { op: "const", value: 0 } : r === "gp" && input.gp !== undefined ? { op: "const", value: input.gp } : r.startsWith("slot:") ? { op: "unknown" } : { op: "entry", detail: r }, reads: [], depth: 0, remat: false }); }
    return entries.get(r)!;
  };
  const registers = new Set<string>(["zero", "memory"]);
  for (const es of events.values()) for (const e of es) {
    e.reads.forEach(r => registers.add(r));
    const ids: number[] = [];
    for (const w of e.writes) { registers.add(w.register); w.inputs?.forEach(r => registers.add(r)); ids.push(nodes.length); nodes.push({ id: nodes.length, register: w.register, at: e.at, term: { op: w.op, value: w.value, detail: w.detail }, reads: [], depth: e.depth, remat: !!w.remat }); }
    writeIds.set(e, ids);
  }
  registers.forEach(entry);
  type State = Map<string, Set<number>>;
  const outputs = new Map<number, State>();
  const inputState = (b: number): State => {
    const state: State = new Map();
    const block = cfg.blocks[b]!;
    for (const r of registers) {
      const ids = new Set<number>();
      if (b === cfg.entry) ids.add(entry(r));
      for (const p of block.predecessors) for (const id of outputs.get(p)?.get(r) ?? []) ids.add(id);
      state.set(r, ids);
    }
    return state;
  };
  const transfer = (b: number, observe: boolean): State => {
    const state = inputState(b);
    for (const e of events.get(b)!) {
      if (observe) for (const r of e.reads) for (const id of state.get(r) ?? []) nodes[id]!.reads.push(e.at);
      const ids = writeIds.get(e)!;
      if (observe) e.writes.forEach((w, n) => { nodes[ids[n]!]!.term.args = (w.inputs ?? []).map(r => [...state.get(r) ?? []]); });
      e.writes.forEach((w, n) => state.set(w.register, new Set([ids[n]!])));
    }
    return state;
  };
  const stateKey = (s: State): string => [...s].map(([r, ids]) => `${r}:${[...ids].sort((a,b) => a-b)}`).join("|");
  let changed = true, passes = 0;
  const bound = Math.max(2, nodes.length + cfg.blocks.length + 1);
  while (changed && passes++ < bound) {
    changed = false;
    for (const b of cfg.reversePostorder) { const s = transfer(b, false); if (stateKey(s) !== (outputs.has(b) ? stateKey(outputs.get(b)!) : "")) { outputs.set(b, s); changed = true; } }
  }
  if (changed) throw new Error("web reaching definitions did not converge within finite-domain bound");
  for (const b of cfg.reversePostorder) transfer(b, true);
  const memo = new Map<number, ValueIdentity | null>();
  const identify = (id: number, visiting = new Set<number>()): ValueIdentity | null => {
    if (memo.has(id)) return memo.get(id)!;
    if (visiting.has(id) || visiting.size > 256) return null;
    const n = nodes[id]!, t = n.term, path = new Set(visiting).add(id);
    const args = (t.args ?? []).map(ids => {
      const vs = ids.map(x => identify(x, path));
      return vs.length > 0 && vs.every(v => v && v.key === vs[0]!.key) ? vs[0]! : null;
    });
    let v: ValueIdentity | null = null;
    if (t.op === "const" || t.op === "high") v = constant(t.value!, t.op === "high" ? "symbol-high" : "constant");
    else if (t.op === "entry") v = { key: `entry:${t.detail}`, kind: "entry", description: `entry $${t.detail}` };
    else if (t.op === "memory") v = { key: `memory:${t.detail}`, kind: "derived", description: t.detail! };
    else if (t.op === "call-result") v = { key: `call:${t.detail}`, kind: "call-result", description: `result ${t.detail}` };
    else if (["copy", "slot-load"].includes(t.op)) v = args[0] ?? null;
    else if (t.op.startsWith("load:") && args.every(Boolean) && args.length === 2) {
      const address = expressionIdentity("add", [args[0]!], t.value)!;
      const loadOp = insns[n.at]!.op;
      v = { key: `${t.op}:${digest(`${address.key}|${args[1]!.key}`)}`, kind: "load", description: `${t.op}(${address.description};${args[1]!.description})`, memory: { addressKey: address.key, address: address.key.startsWith("const:") ? Number(address.key.slice(6)) : null, width: loadWidth(loadOp), signed: loadSigned(loadOp) } };
    } else if (t.op !== "unknown" && args.length && args.every(Boolean)) v = expressionIdentity(t.op, args as ValueIdentity[], t.value);
    if (v && /^const:/.test(v.key) && t.op !== "high") {
      const address = Number(v.key.slice(6)), symbol = input.symbols?.get(address);
      if (symbol) v = { ...v, kind: "address", description: `${symbol} (0x${address.toString(16)})` };
    }
    memo.set(id, v); return v;
  };
  // Union alternative reaching definitions of the SAME register at a use.
  // Never union a register copy: that is exactly the partition under study.
  const parent = nodes.map(n => n.id);
  const root = (n: number): number => parent[n] === n ? n : (parent[n] = root(parent[n]!));
  const union = (ids: number[]): void => { if (ids.length) for (const id of ids.slice(1)) parent[root(id)] = root(ids[0]!); };
  for (const b of cfg.reversePostorder) {
    const s = inputState(b);
    for (const e of events.get(b)!) {
      for (const r of e.reads) union([...s.get(r) ?? []]);
      e.writes.forEach((w, n) => s.set(w.register, new Set([writeIds.get(e)![n]!])));
    }
  }
  const groups = new Map<number, Node[]>();
  for (const n of nodes) if (!FIXED.has(n.register) && !n.register.startsWith("slot:") && n.register !== "memory") { const k = root(n.id); const ns = groups.get(k) ?? []; ns.push(n); groups.set(k, ns); }
  const webs: Web[] = [], webOf = new Map<number, string>();
  const calls = [...callOrdinals.keys()];
  for (const ns of groups.values()) {
    /* A join has several reaching defs for ONE operand occurrence. Take
     * the maximum multiplicity per instruction, not their sum. Two textual
     * occurrences in one instruction still count twice. */
    const occurrences = new Map<number, number>();
    for (const n of ns) {
      const counts = new Map<number, number>();
      n.reads.forEach(at => counts.set(at, (counts.get(at) ?? 0) + 1));
      for (const [at, count] of counts) occurrences.set(at, Math.max(occurrences.get(at) ?? 0, count));
    }
    const reads = [...occurrences].flatMap(([at, count]) => Array<number>(count).fill(at)).sort((a,b) => a-b);
    if (!reads.length) continue; // dead writes are not live webs
    const births = ns.map(n => n.at), birth = Math.min(...births), lastRead = Math.max(...reads);
    const death = Math.max(lastRead, ...births), rangeStart = Math.min(Math.max(0, birth), ...reads);
    const identities = [...new Map(ns.map(n => identify(n.id)).filter((v): v is ValueIdentity => !!v).map(v => [v.key, v])).values()];
    const proven = ns.every(n => identify(n.id) !== null) && identities.length === 1;
    const id = `w${webs.length}`;
    ns.forEach(n => webOf.set(n.id, id));
    webs.push({ id, identity: proven ? identities[0]! : null, identities, status: proven ? "proven" : "undetermined", birth, birthValue: identify(ns.find(n => n.at === birth)!.id), death, readCount: reads.length, liveLength: death - rangeStart + 1,
      estimatedWeightedReferences: ns.reduce((sum, n) => sum + (n.at < 0 ? 0 : 2 ** Math.min(20, n.depth)), 0) + reads.reduce((sum, at) => sum + 2 ** Math.min(20, depths[at]!), 0),
      entry: birth < 0, rematerializations: ns.filter(n => n.remat).map(n => n.at),
      residences: [{ register: ns[0]!.register, birth, lastRead, definitions: births.filter(x => x >= 0).sort((a,b) => a-b), reads, acrossCalls: calls.filter(at => birth < at && death > at + 1) }],
      evidence: [proven ? "All reaching definitions prove the same value." : "Join/loop/opaque definition prevents one proven identity."] });
  }
  const copies: CopyEdge[] = [];
  for (const es of events.values()) for (const e of es) {
    if (!e.copy) continue;
    const n = nodes[writeIds.get(e)![0]!]!, from = n.term.args?.[0] ?? [];
    const fromWebs = [...new Set(from.map(id => webOf.get(id)).filter(Boolean))];
    const to = webOf.get(n.id);
    if (to && fromWebs.length === 1) copies.push({ at: e.at, from: fromWebs[0]!, to, delaySlot: delaySlots.has(e.at), rematerialized: e.copy.remat });
  }
  const transitions: ValueTransition[] = [];
  for (const n of nodes) {
    const output = webOf.get(n.id);
    if (!output || n.at < 0 || !n.term.args?.length) continue;
    const inputs = n.term.args.map(ids => [...new Set(ids.map(id => webOf.get(id)).filter((id): id is string => !!id))]);
    if (inputs.every(ids => ids.length === 1)) transitions.push({ at: n.at, operation: n.term.op, output, inputs: inputs.map(ids => ids[0]!) });
  }
  return { schemaVersion: 1, functionName: input.functionName, side: input.side ?? "target", byteHash: createHash("sha256").update(input.bytes).digest("hex"), instructionCount: insns.length, machine: { vram: input.vram, words: insns.map(i => i.word) }, webs, copies, transitions, deadWrites: nodes.filter(n => n.at >= 0 && !n.reads.length && !FIXED.has(n.register) && !n.register.startsWith("slot:") && n.register !== "memory").map(n => ({ register: n.register, at: n.at, identity: identify(n.id) })), caveats: [...new Set(caveats)] };
}
