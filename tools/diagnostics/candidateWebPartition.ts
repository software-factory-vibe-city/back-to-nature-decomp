/** Candidate-side dump parser. The observed final partition and the pre-reload
 * pseudo partition are separate layers: comparing pseudo counts directly with
 * machine register counts would report defects on byte-exact functions. */
import { parseRtlInstructions, FIRST_PSEUDO_REGISTER, hardRegisterName } from "../agent/compiler-trace/rtl-parser.js";
import { analyzeAllocation } from "../agent/compiler-trace/local-allocation.js";
import { expressionIdentity, type ValueIdentity, type WebPartition } from "./webPartition.js";
import type { LifetimeRange, QuantitySummary, ConflictSummary } from "../agent/compiler-trace/types.js";
import { reconstructHardRegisterLifetimes } from "../agent/allocator-counterfactual/analyze.js";
import type { HardRegisterLifetime } from "../agent/allocator-counterfactual/types.js";
export interface DumpInputs { rtl: string; lreg: string; greg: string }
export interface PseudoSetBinding {
  uid: number; order: number; block: number | null; identity: ValueIdentity | null;
  operation: string; selfInput: boolean;
}
export interface PseudoWeb {
  pseudo: number;
  identity: ValueIdentity | null;
  sets: number | null;
  weightedReferences: number | null;
  allocatorLiveLength: number | null;
  hardRegister: string | null;
  allocationStage: string | null;
  attributes: string[];
  quantity: QuantitySummary | null;
  preferences: number[];
  conflicts: ConflictSummary[];
  lifetimes: LifetimeRange[];
  birthUid: number | null;
  birthOrder: number | null;
  setUids: number[];
  setBindings: PseudoSetBinding[];
  useUids: number[];
  deathUids: number[];
  copyFrom: number[];
  memoryLoad: { address: number; width: 1 | 2 | 4; signed: boolean } | null;
  machineWebs: string[];
  attribution: "identity-and-register" | "unique-memory-access-and-register" | "undetermined";
}
export interface ExplicitHardLifetime extends HardRegisterLifetime { birthExpression: string | null; deathExpression: string | null }
export interface CandidatePartition extends WebPartition {
  side: "candidate";
  pseudoWebs: PseudoWeb[];
  hardRegisterLifetimes: ExplicitHardLifetime[];
  dumpFormat: "gcc-2.95-print-rtl";
}
// S-expression parsing (not a C parser): quoted symbols, brackets and nested
// operands remain structured; REG_DEAD/REG_EQUIV notes are never operand reads.
type S = string | S[];
function parse(text: string): S[] {
  const tokens = text.match(/"(?:\\.|[^"\\])*"|[()[\]]|[^\s()[\]]+/g) ?? [];
  let at = 0;
  const value = (): S => {
    const token = tokens[at++];
    if (token === undefined) throw new Error("Truncated RTL expression");
    if (token !== "(" && token !== "[") return token;
    const end = token === "(" ? ")" : "]", out: S[] = [];
    while (tokens[at] !== end) { if (at >= tokens.length) throw new Error("Unbalanced RTL expression"); out.push(value()); }
    at++; return out;
  };
  const out: S[] = [];
  while (at < tokens.length) out.push(value());
  return out;
}
function findSet(tree: S): S[] | null {
  if (!Array.isArray(tree)) return null;
  if (tree[0] === "set") return tree;
  for (const child of tree) { const set = findSet(child); if (set) return set; }
  return null;
}
function opOf(s: S): string { return Array.isArray(s) && typeof s[0] === "string" ? s[0].split(/[/:]/)[0]! : ""; }
function regOf(s: S): number | null { return Array.isArray(s) && opOf(s) === "reg" && typeof s[1] === "string" ? Number(s[1]) : null; }
function unusedRegisters(s: S): number[] {
  if (!Array.isArray(s)) return [];
  if (s[0] === "expr_list:REG_UNUSED" && s[1]) {
    const register = regOf(s[1]);
    return [...(register === null ? [] : [register]), ...s.slice(2).flatMap(unusedRegisters)];
  }
  return s.flatMap(unusedRegisters);
}
function quotedString(s: S): string | null {
  if (typeof s === "string") return s.startsWith('"') ? JSON.parse(s) as string : null;
  for (const child of s) { const value = quotedString(child); if (value !== null) return value; }
  return null;
}

export function extractCandidatePartition(observed: WebPartition, dumps: DumpInputs, symbols: ReadonlyMap<string, number> = new Map()): CandidatePartition {
  const names = [dumps.rtl, dumps.lreg, dumps.greg].map(d => /^;; Function (\S+)/m.exec(d)?.[1]);
  if (names.some(n => !n)) throw new Error("Unknown RTL dump format: missing Function header");
  if (names.some(n => n !== observed.functionName)) throw new Error("RTL dumps do not belong to the observed function");
  const lreg = parseRtlInstructions(dumps.lreg, "lreg"), rtl = parseRtlInstructions(dumps.rtl, "rtl");
  const allocation = analyzeAllocation(dumps.lreg, dumps.greg, lreg);
  const defs = new Map<number, Array<{ source: S; uid: number; order: number; block: number | undefined }>>();
  for (const insn of lreg) {
    const tree = parse(insn.text), set = tree.map(findSet).find(Boolean);
    if (!set || set.length !== 3) continue;
    const r = regOf(set[1]!);
    if (r === null) continue;
    const ds = defs.get(r) ?? []; ds.push({ source: set[2]!, uid: insn.uid, order: insn.order, block: insn.block }); defs.set(r, ds);
  }
  const identify = (s: S, path = new Set<number>(), before = Infinity, block?: number): ValueIdentity | null => {
    if (!Array.isArray(s)) return null;
    const op = opOf(s);
    const header = s[0];
    if (typeof header === "string" && header.includes(":") && !header.endsWith(":SI")) return null;
    if (op === "const_int" && typeof s[1] === "string" && /^-?\d+$/.test(s[1])) {
      const n = Number(s[1]) >>> 0; return { key: `const:${n}`, kind: "constant", description: `0x${n.toString(16)}` };
    }
    if (op === "reg") {
      const r = regOf(s)!;
      if (r === 0) return { key: "const:0", kind: "constant", description: "0" };
      if (path.has(r) || path.size > 256) return null;
      const ds = defs.get(r);
      // Multi-set values are resolved only within the SAME basic block,
      // at the use's strictly earlier SET. Never choose an arbitrary branch
      // definition or pretend a whole multi-set pseudo has one identity.
      const prior = ds?.filter(d => d.order < before && (ds.length === 1 || (block !== undefined && d.block === block))).at(-1);
      if (prior) return identify(prior.source, new Set(path).add(r), prior.order, prior.block);
      if (!ds && r < FIRST_PSEUDO_REGISTER && r >= 4 && r <= 7) return { key: `entry:${hardRegisterName(r)}`, kind: "entry", description: `entry $${hardRegisterName(r)}` };
      return null;
    }
    if (op === "symbol_ref") {
      const symbol = quotedString(s);
      // GCC's leading '*' marks a verbatim assembler name (e.g. a C
      // declarator asm alias). It is not part of the relocated ELF symbol.
      const n = symbol ? symbols.get(symbol) ?? (symbol.startsWith("*") ? symbols.get(symbol.slice(1)) : undefined) : undefined;
      return n === undefined ? null : { key: `const:${n >>> 0}`, kind: "address", description: symbol! };
    }
    if (op === "const") return s[1] ? identify(s[1], path, before, block) : null;
    if (op === "high") {
      const v = s[1] ? identify(s[1], path, before, block) : null;
      if (!v || !v.key.startsWith("const:")) return null;
      const n = ((Number(v.key.slice(6)) + 0x8000) & 0xffff0000) >>> 0;
      return { key: `const:${n}`, kind: "symbol-high", description: `high(${v.description})` };
    }
    // LO_SUM's full address is its second operand, not high + full-symbol.
    if (op === "lo_sum") return s[2] ? identify(s[2], path, before, block) : null;
    const mapped = ({ plus: "add", minus: "sub", ashift: "sll", ashiftrt: "sra", lshiftrt: "srl", ior: "or", and: "and", xor: "xor" } as Record<string, string>)[op];
    if (!mapped || s.length !== 3) return null;
    const a = identify(s[1]!, path, before, block), b = identify(s[2]!, path, before, block);
    return a && b ? expressionIdentity(mapped, [a, b]) : null;
  };
  const memoryLoad = (s: S, before: number): PseudoWeb["memoryLoad"] => {
    if (!Array.isArray(s)) return null;
    let mem = s, signed: boolean | null = null;
    if (["zero_extend", "sign_extend"].includes(opOf(s))) { signed = opOf(s) === "sign_extend"; if (!Array.isArray(s[1])) return null; mem = s[1]; }
    if (opOf(mem) !== "mem" || typeof mem[0] !== "string" || !mem[1]) return null;
    const mode = mem[0].split(":")[1], width = mode === "QI" ? 1 : mode === "HI" ? 2 : mode === "SI" ? 4 : null;
    if (!width || (width !== 4 && signed === null)) return null;
    const address = identify(mem[1], new Set(), before);
    return address?.key.startsWith("const:") ? { address: Number(address.key.slice(6)), width, signed: signed ?? true } : null;
  };
  const ids = new Set([...allocation.records.keys(), ...defs.keys()].filter(r => r >= FIRST_PSEUDO_REGISTER));
  const pseudoWebs: PseudoWeb[] = [];
  for (const pseudo of [...ids].sort((a,b) => a-b)) {
    const ds = defs.get(pseudo) ?? [], record = allocation.records.get(pseudo);
    const identity = ds.length === 1 ? identify(ds[0]!.source, new Set([pseudo]), ds[0]!.order, ds[0]!.block) : null;
    const containsReg = (s: S): boolean => Array.isArray(s) && (regOf(s) === pseudo || s.some(containsReg));
    const setBindings = ds.map(d => ({ uid: d.uid, order: d.order, block: d.block ?? null, identity: identify(d.source, new Set(), d.order, d.block), operation: opOf(d.source), selfInput: containsReg(d.source) }));
    const born = rtl.find(i => i.sets.some(r => r.register === pseudo));
    const hardRegister = record?.assignedHardReg === undefined ? null : hardRegisterName(record.assignedHardReg);
    const machineWebs = identity ? observed.webs.filter(w => w.identity?.key === identity.key && w.residences.some(r => r.register === hardRegister)).map(w => w.id) : [];
    pseudoWebs.push({ pseudo, identity, sets: record?.header?.sets ?? null, weightedReferences: record?.header?.uses ?? null, allocatorLiveLength: record?.header?.span ?? null, hardRegister, allocationStage: record?.allocationStage ?? null, attributes: record?.header?.attributes ?? [], quantity: record?.quantity ?? null, preferences: record?.preferences ?? [], conflicts: record?.conflicts ?? [], lifetimes: record?.lifetimes ?? [], birthUid: born?.uid ?? null, birthOrder: born?.order ?? null,
      setUids: lreg.filter(i => i.sets.some(r => r.register === pseudo)).map(i => i.uid), setBindings,
      useUids: lreg.filter(i => i.uses.some(r => r.register === pseudo)).map(i => i.uid),
      deathUids: lreg.filter(i => i.deaths.some(r => r.register === pseudo)).map(i => i.uid),
      copyFrom: ds.map(d => regOf(d.source)).filter((r): r is number => r !== null), memoryLoad: ds.length === 1 ? memoryLoad(ds[0]!.source, ds[0]!.order) : null, machineWebs,
      attribution: machineWebs.length === 1 ? "identity-and-register" : "undetermined" });
  }
  // A load can have a proven absolute address while its memory value cannot
  // be reconstructed in RTL. Project only a unique, single-def memory access
  // in BOTH directions, with identical width/signedness and assigned register.
  // This is reconstructed correspondence, not original-source provenance.
  const accessMatches = (p: PseudoWeb) => observed.webs.filter(w => p.memoryLoad && w.identity?.memory?.address === p.memoryLoad.address && w.identity.memory.width === p.memoryLoad.width && w.identity.memory.signed === p.memoryLoad.signed && w.residences.some(r => r.register === p.hardRegister) && w.residences.flatMap(r => r.definitions).length === 1);
  for (const p of pseudoWebs) if (p.attribution === "undetermined" && p.memoryLoad) {
    const webs = accessMatches(p);
    if (webs.length !== 1 || pseudoWebs.filter(other => accessMatches(other).some(w => w.id === webs[0]!.id)).length !== 1) continue;
    p.machineWebs = [webs[0]!.id]; p.attribution = "unique-memory-access-and-register";
  }
  const byUid = new Map(lreg.map(i => [i.uid, i]));
  // The shared interval reconstructor closes on REG_DEAD and SET, but does
  // not close an unused call result or implicit call clobbers. Do not promote
  // such an overlong interval into an actionable overlap. Reject unused births
  // and scratch intervals crossing a subsequent call; absence remains unknown.
  const unused = new Map(lreg.map(i => [i.uid, parse(i.text).flatMap(unusedRegisters)]));
  const hardRegisterLifetimes = reconstructHardRegisterLifetimes(dumps.lreg, lreg).filter(range => {
    if (range.birthUid !== undefined && unused.get(range.birthUid)?.includes(range.register)) return false;
    if (/^(v[01]|a[0-3]|t[0-9])$/.test(range.registerName) && lreg.some(i => i.kind === "call_insn" && i.block === range.block && i.order > range.birthIndex && i.order < range.deathIndex)) return false;
    return true;
  }).map(range => ({
    ...range,
    birthExpression: range.birthUid === undefined ? null : byUid.get(range.birthUid)?.expression ?? null,
    deathExpression: range.deathUid === undefined ? null : byUid.get(range.deathUid)?.expression ?? null,
  }));
  return { ...observed, side: "candidate", dumpFormat: "gcc-2.95-print-rtl", pseudoWebs, hardRegisterLifetimes, caveats: [...observed.caveats, ...allocation.caveats, "Pre-reload pseudo quantities are separate from observed machine webs; absent/ambiguous projection is undetermined, not a partition defect.", "Explicit hard-register and pseudo intervals are reconstructed from lreg SET/REG_DEAD/live-in evidence, not private allocator conflicts; unused births and scratch intervals spanning a subsequent call are excluded as unreliable."] };
}
