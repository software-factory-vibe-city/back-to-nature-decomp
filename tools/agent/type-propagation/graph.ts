/** Original-code evidence graph, independent of worklist eligibility and C bodies. */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { loadContainers, containerTargetPath, vramToRom, type Container } from "../../lib/container.js";
import { loadFunctionSpans, loadSymbolIndex, requireFunctionLocation, type FunctionSpan } from "../../lib/symbolIndex.js";
import { ROOT } from "../decompToolchain.js";
import { digest, filesUnder, snapshot } from "../../lib/contentCache.js";
import { decodeBytes } from "../matching-reconstruction/exec.js";
import { buildMachineIr, type MachineIrReport } from "../machine-ir/index.js";
import { callbackTablesFromData, type CallbackTable } from "./data.js";
import type { Prototype } from "../calleeTruth.js";
import { DEFAULT_BOUNDS, type Bounds, type EvidenceGraph, type Summary, type Relation } from "./model.js";
import { localSummary, baseBias, storedValue } from "./summary.js";
import { inspectType } from "./c-types.js";

interface IndexedFunction { id: string; name: string; container: Container; span: FunctionSpan; calls: string[]; references: number[] }
interface OriginalIndex {
  identity: string; nodes: Map<string, IndexedFunction>; incoming: Map<string, string[]>;
  instructions: number; complete: boolean; inputs: string[];
  resolve: (container: string, address: number) => string | undefined;
}
let cached: OriginalIndex | undefined;
function copyIndex(index: OriginalIndex): OriginalIndex {
  return { ...index, nodes: structuredClone(index.nodes), incoming: structuredClone(index.incoming), inputs: [...index.inputs] };
}
/** In-process immutable index. No persistent cache, worklist graph or candidate C. */
export function originalIndex(limit = DEFAULT_BOUNDS.indexInstructions): OriginalIndex {
  const containers = loadContainers();
  const inputs = containers.flatMap((c) => [containerTargetPath(c), join(ROOT, c.paths.splat), join(ROOT, c.paths.symbolAddrs),
    join(ROOT, c.paths.undefinedFuncs), join(ROOT, c.paths.undefinedSyms), join(ROOT, c.paths.sectionLayout), join(ROOT, c.paths.ldScript),
    ...filesUnder(join(ROOT, c.paths.asmDir)).filter((p) => p.endsWith(".s"))])
    .concat(["build/engine_syms.txt", "build/dep_syms.txt", "build/lib_bss_syms.txt", "configs/overlays.json"].map((p) => join(ROOT, p)));
  const identity = digest(JSON.stringify([limit, snapshot(ROOT, inputs), containers]));
  if (cached?.identity === identity) return copyIndex(cached);
  const nodes = new Map<string, IndexedFunction>();
  const addresses = new Map<string, Map<number, string>>();
  for (const container of containers) {
    const byAddress = new Map<number, string>(); addresses.set(container.id, byAddress);
    for (const span of loadFunctionSpans(container)) {
      const id = `${container.id}:${span.name}`;
      nodes.set(id, { id, name: span.name, container, span, calls: [], references: [] });
      byAddress.set(span.vram, id);
    }
    /* SDK symbols have no C/asm subsegment. Admit external names only in
       witnessed code ranges, never every non-D-looking data label. */
    const layoutPath = join(ROOT, container.paths.sectionLayout);
    const layout = existsSync(layoutPath) ? JSON.parse(readFileSync(layoutPath, "utf8")) as { textStart?: number; dataStart?: number } : {};
    for (const [address, name] of loadSymbolIndex(container).byAddress) {
      const rom = vramToRom(container, address);
      const inCode = layout.textStart !== undefined && layout.dataStart !== undefined && rom >= layout.textStart && rom < layout.dataStart;
      if (inCode && !byAddress.has(address) && !/^D_|_D_|jtbl_|^\.L/.test(name))
        byAddress.set(address, `${container.id}:${name}`);
    }
  }
  const resolve = (container: string, address: number) => {
    const local = addresses.get(container)?.get(address >>> 0);
    const engine = addresses.get("exe")?.get(address >>> 0);
    /* Engine exports are shared; an overlay-local span takes precedence. */
    if (local && nodes.has(local)) return local;
    if (engine) return engine;
    return local;
  };
  const incoming = new Map<string, string[]>();
  const images = new Map<string, Buffer>();
  let instructions = 0, complete = true;
  for (const node of [...nodes.values()].sort((a, b) => a.id.localeCompare(b.id))) {
    const path = containerTargetPath(node.container);
    if (!existsSync(path) || instructions + node.span.size / 4 > limit) { complete = false; continue; }
    let image = images.get(path); if (!image) { image = readFileSync(path); images.set(path, image); }
    const rom = vramToRom(node.container, node.span.vram);
    if (rom < 0 || rom + node.span.size > image.length) { complete = false; continue; }
    const words = decodeBytes(image.subarray(rom, rom + node.span.size), node.span.vram);
    instructions += words.length;
    /* References are selection hints only. They never establish a call or a
       store/load relation; SSA below decides those. */
    const constants = new Map<number, number>();
    for (const word of words) {
      if (word.op === "jal" || (word.op === "j" && (word.target! < node.span.vram || word.target! >= node.span.vram + node.span.size))) {
        const target = word.target === undefined ? undefined : resolve(node.container.id, word.target);
        if (target) node.calls.push(target);
      }
      if (word.op === "lui") constants.set(word.rt, (word.uimm << 16) >>> 0);
      else if ((word.op === "addiu" || word.op === "ori") && constants.has(word.rs)) {
        const address = word.op === "ori" ? (constants.get(word.rs)! | word.uimm) >>> 0 : (constants.get(word.rs)! + word.simm) >>> 0;
        node.references.push(address); constants.set(word.rt, address);
      } else if (["lw", "lh", "lhu", "lb", "lbu", "sw", "sh", "sb"].includes(word.op)) {
        const base = word.rs === 28 ? node.container.gpValue : constants.get(word.rs);
        if (base !== undefined) node.references.push((base + word.simm) >>> 0);
        if (word.op.startsWith("l")) constants.delete(word.rt);
      } else { if (word.rt) constants.delete(word.rt); if (word.rd) constants.delete(word.rd); }
    }
    node.calls = [...new Set(node.calls)].sort(); node.references = [...new Set(node.references)].sort((a, b) => a - b);
    for (const target of node.calls) incoming.set(target, [...(incoming.get(target) ?? []), node.id]);
  }
  cached = { identity, nodes, incoming, instructions, complete, inputs, resolve }; return copyIndex(cached);
}

export interface GraphOptions { bounds?: Partial<Bounds>; seed?: (name: string) => Prototype | undefined; signal?: AbortSignal }
export function buildEvidenceGraph(functionName: string, options: GraphOptions = {}): EvidenceGraph {
  const bounds = { ...DEFAULT_BOUNDS, ...options.bounds };
  for (const key of Object.keys(bounds) as Array<keyof Bounds>)
    if (!Number.isInteger(bounds[key]) || bounds[key] < 1 || bounds[key] > DEFAULT_BOUNDS[key]) throw new Error(`Invalid ${key} bound`);
  const index = originalIndex(bounds.indexInstructions);
  const location = requireFunctionLocation(functionName);
  const root = `${location.container.id}:${functionName}`;
  const graph: EvidenceGraph = { root, bounds, nodes: [], relations: [], frontier: [], unsupported: [], inputs: [...index.inputs],
    indexComplete: index.complete, consumed: { functions: 0, instructions: 0, indexInstructions: index.instructions, storageDependencies: 0 } };
  const summaries = new Map<string, Summary>();
  const tables = new Map<string, CallbackTable>();
  const tableAddresses = new Map<string, number>();
  const loadedData = new Set<string>();
  const loadTables = (container: Container) => {
    if (loadedData.has(container.id)) return; loadedData.add(container.id);
    const directory = join(ROOT, container.paths.asmDir, "data");
    if (!existsSync(directory)) return;
    const symbols = loadSymbolIndex(container);
    for (const file of readdirSync(directory).filter((f) => f.endsWith(".s")).sort()) {
      const path = join(directory, file), text = readFileSync(path, "utf8"); graph.inputs.push(path);
      const names = [...text.matchAll(/\b(?:dlabel|glabel)\s+(\w+)/g)].map((m) => m[1]!);
      for (const table of callbackTablesFromData(text, names, path, (name) => {
        try { requireFunctionLocation(name); return true; } catch { return false; }
      })) {
        const address = [...symbols.byAddress].find(([, name]) => name === table.symbol)?.[0];
        if (address === undefined) continue;
        const image = readFileSync(containerTargetPath(container));
        const rom = vramToRom(container, address);
        if (rom < 0 || rom + table.entries.length * 4 > image.length || table.entries.some((e) => {
          const dest = index.resolve(container.id, image.readUInt32LE(rom + e.offset));
          return dest?.split(":").slice(1).join(":") !== e.functionName;
        })) { graph.frontier.push({ node: `${container.id}:${table.symbol}`, reason: "callback data differs from original bytes" }); continue; }
        tables.set(`${container.id}:${table.symbol}`, table); tableAddresses.set(`${container.id}:${table.symbol}`, address);
      }
    }
  };
  const queue = [root], incomingQueue: string[] = [], seen = new Set<string>();
  const enqueue = (id: string) => { if (!seen.has(id) && !queue.includes(id)) queue.push(id); };
  while (queue.length || incomingQueue.length) {
    const id = queue.shift() ?? incomingQueue.shift()!;
    if (seen.has(id)) continue; seen.add(id);
    if (options.signal?.aborted) { graph.frontier.push({ node: id, reason: "cancelled" }); break; }
    const node = index.nodes.get(id);
    if (!node) {
      if (!options.seed?.(id.split(":").slice(1).join(":"))) graph.frontier.push({ node: id, reason: "no configured original function span or independent external contract" });
      continue;
    }
    if (graph.nodes.length >= bounds.functions || graph.consumed.instructions + node.span.size / 4 > bounds.instructions) {
      graph.frontier.push({ node: id, reason: "function/instruction budget" }); continue;
    }
    try {
      const { summary, relations } = localSummary(buildMachineIr(node.name));
      const seed = options.seed?.(node.name);
      if (seed) {
        summary.seed = seed;
        for (const [parameter, slot] of (seed.slots ?? []).entries()) if (slot === null)
          graph.unsupported.push({ node: id, at: node.span.vram, reason: `parameter ${parameter}: wide/by-value/unknown-layout ABI is outside the word-summary domain (${seed.paramTypes?.[parameter]})` });
        if (!seed.returnsVoid && seed.returnType && !inspectType(seed.returnType).word)
          graph.unsupported.push({ node: id, at: node.span.vram, reason: `wide/hidden/unknown-typedef return ABI is outside the word-summary domain (${seed.returnType})` });
        if (seed.usedParameters) for (const slot of summary.slots) {
          const parameter = seed.slots?.indexOf(slot.slot) ?? -1;
          slot.used = parameter >= 0 && seed.usedParameters[parameter] === true;
        }
      }
      summaries.set(id, summary); graph.nodes.push(summary); graph.relations.push(...relations);
      graph.consumed.functions++; graph.consumed.instructions += summary.report.size.instructions;
      loadTables(node.container);
      for (const opaque of summary.report.unmodelled) graph.unsupported.push({ node: id, at: opaque.vram, reason: opaque.note });
      for (const call of summary.calls) {
        const effect = summary.report.ir.effects[call.effect];
        const word = summary.report.ir.cfg.insns.find((i) => i.vram === call.at);
        const target = effect?.op.kind === "call" ? effect.op.target : word?.target;
        if (target !== undefined) {
          const dest = index.resolve(node.container.id, target);
          if (dest) { call.targets = [dest]; call.closed = true; if (!seed || id === root) enqueue(dest); }
          else call.remainder.push(`unresolved original direct address 0x${target.toString(16)} in ${node.container.id}`);
        } else if (call.through !== undefined) {
          const targets = localTargets(summary.report, call.through, index, tables, tableAddresses, bounds.indirectTargets);
          call.targets = targets.targets; call.closed = targets.closed; call.remainder = targets.remainder;
          if (targets.table) call.table = targets.table;
          if (!seed || id === root) call.targets.forEach(enqueue);
        }
      }
      /* Dependency-first traversal. Incoming originals survive matched status.
         Address-taking selects a publisher, but does not call it a caller. */
      if (!seed && summary.slots.some((s) => s.used))
        for (const caller of index.incoming.get(id) ?? []) if (!seen.has(caller)) incomingQueue.push(caller);
      if (!seed && summary.calls.some((c) => c.kind === "indirect")) for (const user of index.nodes.values()) {
        if (user.references.includes(node.span.vram) && !seen.has(user.id)) incomingQueue.push(user.id);
      }
      const storage = summary.report.ir.values.flatMap((v) => v.op.kind === "load" ? [baseBias(summary.report, v.op.address)] : [])
        .filter((p) => p?.base === "absolute").map((p) => p!.bias >>> 0);
      /* Shared storage users only for live loaded function-pointer dependencies. */
      if (!seed && summary.calls.some((c) => c.kind === "indirect" && !c.closed)) for (const user of index.nodes.values()) {
        if (user.container.id !== node.container.id && user.container.id !== "exe") continue;
        if (!user.references.some((r) => storage.includes(r)) || seen.has(user.id)) continue;
        if (incomingQueue.includes(user.id)) continue;
        if (graph.consumed.storageDependencies >= bounds.storageDependencies) {
          graph.frontier.push({ node: user.id, reason: "shared-storage dependency budget" }); break;
        }
        graph.consumed.storageDependencies++;
        incomingQueue.push(user.id);
      }
    } catch (e) { graph.frontier.push({ node: id, reason: `original input unavailable: ${String(e)}` }); }
    if (!queue.length && !incomingQueue.length) {
      connectCalls(graph, summaries, index, options.seed);
      for (const summary of summaries.values()) if (!summary.seed || summary.id === root) for (const call of summary.calls)
        for (const target of call.targets) if (index.nodes.has(target) && !seen.has(target)) enqueue(target);
    }
  }
  for (const id of [...queue, ...incomingQueue]) graph.frontier.push({ node: id, reason: "unvisited dependency" });
  connectCalls(graph, summaries, index, options.seed);
  for (const summary of graph.nodes) if (!summary.seed || summary.id === root) for (const call of summary.calls) if (!call.closed)
    graph.frontier.push({ node: summary.id, at: call.at, reason: call.remainder.join("; ") || "indirect target set remains open" });
  graph.nodes.sort((a, b) => a.id.localeCompare(b.id)); graph.relations.sort((a, b) => a.id.localeCompare(b.id));
  graph.frontier = [...new Map(graph.frontier.map((f) => [JSON.stringify(f), f])).values()].sort((a, b) => a.node.localeCompare(b.node));
  graph.unsupported = [...new Map(graph.unsupported.map((u) => [JSON.stringify(u), u])).values()].sort((a, b) => a.node.localeCompare(b.node) || a.at - b.at);
  graph.inputs = [...new Set(graph.inputs)].sort();
  return graph;
}

function localTargets(report: MachineIrReport, value: number, index: OriginalIndex, tables: Map<string, CallbackTable>, addresses: Map<string, number>, bound: number,
  active = new Set<number>()): { targets: string[]; closed: boolean; remainder: string[]; table?: string } {
  const unknown = (why: string) => ({ targets: [] as string[], closed: false, remainder: [why] });
  if (active.has(value) || active.size > 64) return unknown("cyclic/unsupported target value");
  const op = report.ir.values[value]?.op, next = new Set(active).add(value);
  if (op?.kind === "const") {
    const target = index.resolve(report.containerId, op.value);
    return target ? { targets: [target], closed: true, remainder: [] } : unknown(`unknown target address 0x${op.value.toString(16)}`);
  }
  if (op?.kind === "phi") {
    const parts = op.inputs.filter((v) => v !== value).map((v) => localTargets(report, v, index, tables, addresses, bound, next));
    return { targets: [...new Set(parts.flatMap((p) => p.targets))].slice(0, bound), closed: parts.length > 0 && parts.every((p) => p.closed) && parts.flatMap((p) => p.targets).length <= bound,
      remainder: [...new Set(parts.flatMap((p) => p.remainder).concat(parts.flatMap((p) => p.targets).length > bound ? ["indirect target-set budget"] : []))] };
  }
  if (op?.kind === "load" && op.width === 4) {
    const stored = storedValue(report, op.memory, op.address, 4);
    if (stored !== null) return localTargets(report, stored, index, tables, addresses, bound, next);
    const constants = new Set<number>();
    const walk = (id: number, visited = new Set<number>()) => {
      if (visited.has(id) || visited.size > 64) return; visited.add(id);
      const p = report.ir.values[id]?.op;
      if (p?.kind === "const") constants.add(p.value >>> 0);
      if (p?.kind === "binary" && p.op === "add") { walk(p.left, visited); walk(p.right, visited); }
    }; walk(op.address);
    for (const [id, address] of addresses) if (id.startsWith(`${report.containerId}:`) && constants.has(address)) {
      const table = tables.get(id)!;
      const targets = table.entries.map((e) => {
        try { const l = requireFunctionLocation(e.functionName); return `${l.container.id}:${e.functionName}`; } catch { return ""; }
      }).filter(Boolean);
      /* Table membership alone does not prove bounds on the dispatch index or
         absence of writes. Keep the unknown remainder explicitly. */
      return { table: id, targets: targets.slice(0, bound), closed: false, remainder: [`${id}: index range and table immutability not proven`, ...(targets.length > bound ? ["indirect target-set budget"] : [])] };
    }
    return unknown(`v${value}: loaded target has no proven store/table relation at m${op.memory}`);
  }
  return unknown(`v${value}: ${op?.kind ?? "missing"} target remains open`);
}

/** Iteration also resolves formal function-pointer forwarding, retaining an open
 * external-caller remainder. No known table member types its siblings. */
function connectCalls(graph: EvidenceGraph, summaries: Map<string, Summary>, index: OriginalIndex, seed?: GraphOptions["seed"]): void {
  const relationIds = new Set(graph.relations.map((r) => r.id));
  const add = (from: { function: string; value: number }, to: { function: string; value: number }, rule: Relation["rule"], call: Summary["calls"][number], conditional?: string) => {
    const id = `${call.id}:${rule}:${from.function}:${from.value}:${to.function}:${to.value}`;
    if (relationIds.has(id)) return false; relationIds.add(id);
    graph.relations.push({ id, from, to, rule, witness: `original ${call.kind} transfer 0x${call.at.toString(16)}`, ...(conditional ? { conditional } : {}) });
    return true;
  };
  const valueTargets = new Map<string, Set<string>>();
  const endpoint = (fn: string, value: number) => `${fn}:v${value}`;
  const merge = (key: string, targets: Iterable<string>): boolean => {
    const set = valueTargets.get(key) ?? new Set<string>(); let changed = false;
    for (const target of targets) if (!set.has(target)) {
      if (set.size < graph.bounds.indirectTargets) { set.add(target); changed = true; }
      else graph.frontier.push({ node: key, reason: "function-target set budget" });
    }
    valueTargets.set(key, set); return changed;
  };
  for (const summary of summaries.values()) for (const value of summary.report.ir.values) {
    if (value.op.kind === "const") {
      const target = index.resolve(summary.container, value.op.value);
      if (target) merge(endpoint(summary.id, value.id), [target]);
    }
    if (value.op.kind === "load") {
      const stored = storedValue(summary.report, value.op.memory, value.op.address, value.op.width);
      if (stored !== null) {
        /* An exact-width memory relation already exists in localSummary. */
        const op = summary.report.ir.values[stored]?.op;
        if (op?.kind === "const") { const target = index.resolve(summary.container, op.value); if (target) merge(endpoint(summary.id, value.id), [target]); }
      }
    }
  }
  let work = 0;
  while (work <= graph.bounds.propagationSteps) {
    let changed = false;
    for (const relation of graph.relations) {
      if (++work > graph.bounds.propagationSteps) { graph.frontier.push({ node: graph.root, reason: "function-target propagation budget" }); return; }
      changed = merge(endpoint(relation.to.function, relation.to.value), valueTargets.get(endpoint(relation.from.function, relation.from.value)) ?? []) || changed;
    }
    for (const caller of [...summaries.values()].sort((a, b) => a.id.localeCompare(b.id))) for (const call of caller.calls) {
      if (call.through !== undefined) {
        for (const target of valueTargets.get(endpoint(caller.id, call.through)) ?? []) {
          if (!call.targets.includes(target)) {
            if (call.targets.length < graph.bounds.indirectTargets) { call.targets.push(target); changed = true; }
            else { call.closed = false; call.remainder.push("indirect target-set budget"); }
          }
        }
        const formal = caller.slots.find((s) => s.value === call.through);
        if (formal) for (const incoming of summaries.values()) for (const edge of incoming.calls.filter((c) => c.targets.includes(caller.id))) {
          const actual = edge.args[formal.slot];
          const op = actual === undefined || actual === null ? undefined : incoming.report.ir.values[actual]?.op;
          if (op?.kind === "const") {
            const target = index.resolve(incoming.container, op.value);
            if (target && !call.targets.includes(target) && call.targets.length < graph.bounds.indirectTargets) {
              call.targets.push(target); changed = true;
            }
          }
        }
      }
      for (const target of call.targets.sort()) {
        let callee = summaries.get(target);
        if (!callee) {
          const name = target.split(":").slice(1).join(":"), contract = seed?.(name);
          /* External leaf has no original SSA; its declared types are applied
             directly to actual values by the solver's seed rule. */
          if (!contract) continue;
        }
        if (!callee) continue;
        const conditional = !call.closed || call.targets.length > 1 ? `${call.id} targets ${target}` : undefined;
        for (const slot of callee.slots) {
          if (callee.seed && !callee.seed.slots?.includes(slot.slot)) continue;
          const actual = call.args[slot.slot];
          if (slot.used && actual !== undefined && actual !== null) {
            const callerSlot = caller.slots.find((s) => s.value === actual);
            if (callerSlot && !callerSlot.used) { callerSlot.used = true; changed = true; }
          }
          if (actual !== undefined && actual !== null)
            changed = add({ function: caller.id, value: actual }, { function: target, value: slot.value }, "argument", call, conditional) || changed;
        }
        if (!callee.seed || (callee.seed.returnType && inspectType(callee.seed.returnType).word))
          for (const value of callee.returns) for (const result of call.results)
          changed = add({ function: target, value }, { function: caller.id, value: result }, "result", call,
            conditional ?? (callee.returns.length > 1 ? `${call.id} return-path v${value}` : undefined)) || changed;
        if (call.kind === "tail") graph.unsupported.push({ node: caller.id, at: call.at,
          reason: "tail result/stack-argument forwarding is outside the word-summary domain" });
      }
    }
    if (!changed) break;
  }
}
