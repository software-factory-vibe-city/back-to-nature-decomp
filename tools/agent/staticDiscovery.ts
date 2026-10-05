/** Bounded original-word access/pointer evidence. No inferred type is published. */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { buildMachineIr, type MachineIrReport } from "./machine-ir/index.js";
import { resolveAsmSource } from "./decompToolchain.js";
import type { ValueId, Effect } from "./machine-ir/ir.js";
import { requireFunctionLocation, loadSymbolIndex, resolveAddress } from "../lib/symbolIndex.js";
import type { UnknownFact } from "./campaign/packet.js";
import { buildEvidenceGraph } from "./type-propagation/graph.js";
import type { EvidenceGraph } from "./type-propagation/model.js";

import { callbackTablesFromData, type CallbackTable } from "./type-propagation/data.js";
export { callbackTablesFromData, selectDataDefinitions, type CallbackTable } from "./type-propagation/data.js";

export interface AccessFact {
  functionName: string; at?: number; base: string; offset: number; width: 1 | 2 | 4;
  signed: boolean | null; access: "load" | "store"; strides: number[]; evidence: string[];
  originalStorage?: { symbol: string; offset: number; alias: string; aliasOffset: number };
}
export interface DiscoveryReport {
  status: "complete-with-unknowns" | "budget-exhausted" | "unsupported";
  bounds: { functions: number; instructions: number; expressionDepth: number; storageScans: number };
  visited: string[]; excluded: string[]; accesses: AccessFact[];
  pointerFlows: Array<{ from: string; to: string; evidence: string[] }>;
  returnUses: Array<{ caller: string; callee: string; callAt: number; accessAt?: number; offset: number; width: number; evidence: string[] }>;
  records: Array<{ base: string; minimumExtent: number; strides: number[]; conflicts: string[] }>;
  unknowns: UnknownFact[];
  callbackTables: CallbackTable[];
  graph: EvidenceGraph;
}
const BOUNDS = { functions: 96, instructions: 65536, expressionDepth: 32, storageScans: 256 };

export function addressProvenance(report: MachineIrReport, id: ValueId): { base: string; offset: number; strides: number[] } | null {
  const ir = report.ir;
  const provenance = (id: ValueId, active = new Set<number>(), depth = 0): { base: string; offset: number; strides: number[] } | null => {
    if (depth > BOUNDS.expressionDepth || active.has(id)) return null;
    const op = ir.values[id]?.op;
    if (!op || op.kind === "opaque") return null;
    const next = new Set(active).add(id);
    if (op.kind === "entry") return { base: `entry:${op.register}`, offset: 0, strides: [] };
    if (op.kind === "const") return { base: `absolute:0x${(op.value >>> 0).toString(16)}`, offset: 0, strides: [] };
    if (op.kind === "load") return { base: `loaded:${report.functionName}:v${id}`, offset: 0, strides: [] };
    /* Other caller-clobbered registers are not C return values. */
    if (op.kind === "call-result") return op.register === "v0" ? { base: `return:${report.functionName}:e${op.effect}`, offset: 0, strides: [] } : null;
    if (op.kind === "binary" && op.op === "add") {
      const left = ir.values[op.left]?.op;
      const right = ir.values[op.right]?.op;
      const constant = right?.kind === "const" ? right.value : left?.kind === "const" ? left.value : undefined;
      if (constant === undefined) return null;
      const base = provenance(right?.kind === "const" ? op.left : op.right, next, depth + 1);
      return base ? { ...base, offset: base.offset + (constant | 0) } : null;
    }
    if (op.kind === "phi") {
      const initial = op.inputs.map((i) => provenance(i, next, depth + 1)).filter((p) => p !== null);
      if (!initial.length || initial.some((p) => p.base !== initial[0]!.base || p.offset !== initial[0]!.offset)) return null;
      const strides: number[] = [];
      for (const input of op.inputs) {
        const step = ir.values[input]?.op;
        if (step?.kind === "binary" && step.op === "add" && (step.left === id || step.right === id)) {
          const amount = ir.values[step.left === id ? step.right : step.left]?.op;
          if (amount?.kind === "const") strides.push(amount.value | 0);
        }
      }
      return { ...initial[0]!, strides };
    }
    return null;
  };
  return provenance(id);
}

export function accessesFromIr(report: MachineIrReport): AccessFact[] {
  const ir = report.ir;
  const facts: AccessFact[] = [];
  const add = (address: ValueId, width: 1 | 2 | 4, signed: boolean | null, access: AccessFact["access"], at?: number) => {
    const p = addressProvenance(report, address);
    if (!p) return;
    facts.push({ functionName: report.functionName, ...(at === undefined ? {} : { at }), ...p, width, signed, access,
      evidence: [`${report.functionName}: original word ${at === undefined ? `v${address}` : `0x${at.toString(16)}`}`] });
  };
  for (const v of ir.values) if (v.op.kind === "load") add(v.op.address, v.op.width, v.op.signed, "load", v.vram);
  for (const e of ir.effects) if (e.op.kind === "store") add(e.op.address, e.op.width, null, "store", e.vram);
  return facts;
}

/** Carry only original dereference facts through a witnessed direct call. */
export function callAccessConstraints(caller: MachineIrReport, callee: MachineIrReport, effect: Effect): AccessFact[] {
  if (effect.op.kind !== "call") return [];
  const args = effect.op.args;
  return accessesFromIr(callee).flatMap((fact) => {
    const slot = /^entry:a([0-3])$/.exec(fact.base);
    const argument = slot ? args[Number(slot[1])] : undefined;
    if (argument === null || argument === undefined) return [];
    const origin = addressProvenance(caller, argument);
    return origin ? [{ ...fact, functionName: caller.functionName, at: effect.vram, base: origin.base,
      offset: origin.offset + fact.offset, strides: [...new Set([...origin.strides, ...fact.strides])],
      evidence: [...fact.evidence, `original call word 0x${effect.vram.toString(16)} passes v${argument} in ABI slot ${slot![1]}`] }] : [];
  });
}

export function discoverStatic(functionName: string, root: string, graph = buildEvidenceGraph(functionName)): DiscoveryReport {
  const assembly = resolveAsmSource(functionName);
  const storage = assembly ? [...new Set(readFileSync(assembly, "utf8").match(/\b(?:D_[A-Fa-f0-9]{8}|ovl_\d+_D_[A-Fa-f0-9]{8})\b/g) ?? [])] : [];
  const location = requireFunctionLocation(functionName);
  const dataDirectory = join(root, location.container.paths.asmDir, "data");
  const callbackTables = existsSync(dataDirectory) ? readdirSync(dataDirectory).filter((p) => p.endsWith(".s")).flatMap((p) =>
    callbackTablesFromData(readFileSync(join(dataDirectory, p), "utf8"), storage, relative(root, join(dataDirectory, p)),
      (name) => { try { return requireFunctionLocation(name).container.id === location.container.id || name.startsWith("func_"); } catch { return false; } })) : [];
  const related = [...new Set([functionName, ...graph.nodes.map((n) => n.name)])];
  const result: DiscoveryReport = { status: "complete-with-unknowns", bounds: BOUNDS, visited: [], excluded: [],
    accesses: [], pointerFlows: [], returnUses: [], records: [], unknowns: [], callbackTables, graph };
  if (graph.frontier.length || !graph.indexComplete) {
    result.status = "budget-exhausted";
    for (const item of graph.frontier) result.unknowns.push({ subject: item.node, strength: "unknown", constraints: [],
      evidence: item.at === undefined ? [item.node] : [`original word 0x${item.at.toString(16)}`], missing: item.reason,
      attempted: "recursive original-code dependency graph", bound: JSON.stringify(graph.bounds), stoppedBecause: item.reason,
      inspectNext: [item.node] });
  }
  let used = 0;
  const reports = new Map<string, MachineIrReport>();
  for (const name of related) {
    if (result.visited.length >= BOUNDS.functions) { result.excluded.push(name); result.status = "budget-exhausted"; continue; }
    try {
      const location = requireFunctionLocation(name);
      if (used + location.span.size / 4 > BOUNDS.instructions) { result.excluded.push(name); result.status = "budget-exhausted"; continue; }
      used += location.span.size / 4;
      const report = graph.nodes.find((n) => n.name === name)?.report ?? buildMachineIr(name);
      reports.set(name, report); result.visited.push(name);
      const index = loadSymbolIndex(location.container);
      const facts = accessesFromIr(report);
      const original = resolveAsmSource(name);
      const displacements = new Map(original ? [...readFileSync(original, "utf8").matchAll(/\/\*\s*\w+\s+([A-Fa-f0-9]{8})\s+[A-Fa-f0-9]{8}\s*\*\/\s+\w+\s+\$\w+,\s*(-?(?:0x[A-Fa-f0-9]+|\d+))\(\$\w+\)/g)]
        .map((m) => [parseInt(m[1]!, 16), m[2]!.startsWith("-") ? -Number(m[2]!.slice(1)) : Number(m[2])]) : []);
      for (const fact of facts) {
        const returned = /^return:.*:e(\d+)$/.exec(fact.base);
        const effect = returned ? report.ir.effects.find((e) => e.id === Number(returned[1])) : undefined;
        if (effect?.op.kind === "call" && effect.op.target !== undefined) {
          const callee = resolveAddress(index, effect.op.target)?.symbol;
          if (callee) result.returnUses.push({ caller: name, callee, callAt: effect.vram,
            ...(fact.at === undefined ? {} : { accessAt: fact.at }), offset: fact.offset, width: fact.width,
            evidence: [...fact.evidence, `original call word 0x${effect.vram.toString(16)} to ${callee}; returned $v0 is used as an address`] });
        }
        if (fact.base.startsWith("absolute:")) {
          const address = Number(fact.base.slice("absolute:".length)) + fact.offset;
          const symbol = resolveAddress(index, address >>> 0);
          if (symbol) {
            /* SSA constant folding can collapse (base + displacement) into an
               alias. The original memory operand still witnesses the base web. */
            const displacement = fact.at === undefined ? undefined : displacements.get(fact.at);
            const base = resolveAddress(index, (displacement === undefined ? Number(fact.base.slice("absolute:".length)) : address - displacement) >>> 0);
            if (base) {
              const offset = base.offset + (displacement ?? fact.offset);
              fact.originalStorage = { symbol: base.symbol, offset, alias: symbol.symbol, aliasOffset: symbol.offset };
              fact.evidence.push(`${base.symbol} + 0x${offset.toString(16)} == ${symbol.symbol} + 0x${symbol.offset.toString(16)}`);
            }
            fact.base = `storage:${location.container.id}:${symbol.symbol}`; fact.offset = symbol.offset;
          }
        } else fact.base = `${name}:${fact.base}`;
      }
      result.accesses.push(...facts);
      for (const opaque of report.unmodelled) result.unknowns.push({ subject: name, strength: "unsupported",
        constraints: [], evidence: [`original word 0x${opaque.vram.toString(16)}`], missing: opaque.note,
        attempted: "CFG/SSA lifting", bound: JSON.stringify(BOUNDS), stoppedBecause: `opaque ${opaque.op} breaks proofs through its effects`, inspectNext: [name] });
    } catch (error) {
      result.unknowns.push({ subject: name, strength: "unknown", constraints: [], evidence: [resolveAsmSource(name) ?? name], missing: String(error),
        attempted: "resolve original CFG/SSA", bound: JSON.stringify(BOUNDS), stoppedBecause: "original input unavailable", inspectNext: [name] });
    }
  }
  /* Independent callee pointer-use facts propagate to the caller's SSA argument value.
     All ABI slots remain indexed; no arity or scalar type is synthesized. */
  for (const [name, report] of reports) {
    const index = loadSymbolIndex(requireFunctionLocation(name).container);
    for (const effect of report.ir.effects) {
      if (effect.op.kind !== "call" || effect.op.target === undefined) continue;
      const callee = resolveAddress(index, effect.op.target)?.symbol;
      if (!callee || !reports.has(callee)) continue;
      const carried = callAccessConstraints(report, reports.get(callee)!, effect);
      for (const fact of carried) {
        if (result.accesses.length >= BOUNDS.instructions) { result.status = "budget-exhausted"; break; }
        if (fact.base.startsWith("absolute:")) {
          const address = Number(fact.base.slice("absolute:".length)) + fact.offset;
          const symbol = resolveAddress(index, address >>> 0);
          if (symbol) { fact.base = `storage:${requireFunctionLocation(name).container.id}:${symbol.symbol}`; fact.offset = symbol.offset; }
        } else fact.base = `${name}:${fact.base}`;
        result.accesses.push(fact);
      }
      effect.op.args.forEach((arg, slot) => {
        if (arg === null) return;
        if (result.accesses.some((f) => f.base === `${callee}:entry:a${slot}`)) {
          result.pointerFlows.push({ from: `${name}:v${arg}`, to: `${callee}:ABI-slot-${slot}`,
            evidence: [`call word 0x${effect.vram.toString(16)}`, "callee originally dereferences this incoming slot"] });
        }
      });
    }
  }
  for (const base of [...new Set(result.accesses.map((a) => a.base))].sort()) {
    const accesses = result.accesses.filter((a) => a.base === base);
    const conflicts: string[] = [];
    for (const a of accesses) if (accesses.some((b) => a.offset === b.offset && a.width !== b.width)) conflicts.push(`overlapping widths at ${a.offset}`);
    result.records.push({ base, minimumExtent: Math.max(0, ...accesses.map((a) => a.offset + a.width)),
      strides: [...new Set(accesses.flatMap((a) => a.strides))], conflicts: [...new Set(conflicts)] });
  }
  if (!result.visited.length) result.status = "unsupported";
  return result;
}
