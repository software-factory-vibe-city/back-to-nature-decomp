/** Original-word static-chain census. No source, compiler, or plausibility
 * inputs: only entry-$2 reads and call-boundary-dead frame-address setups.
 * Functions are loaded through the shared splat-text-bounded byte inventory.
 * Unknown control flow/words stay undetermined, never an injection license. */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadContainers, unresolvedCodeMembers } from "../lib/container.js";
import { ROOT } from "../agent/decompToolchain.js";
import { loadMacroFunctions, type MacroFunction, type CensusFinding } from "./macroIdentity.js";
import { decodeMacroBytes, hex, REGISTER_NAMES, type MacroInstruction } from "./macroInstructions.js";

export type ChainForm = "dead-spill" | "save-forward" | "undetermined";
export interface ChainCall {
  setup: number; call: number; target: number | null; offset: number | null;
  placement: "call-delay" | "before-call" | "branch-delay" | "forward";
  verdict: "confirmed-pair" | "caller-candidate" | "rejected" | "undetermined";
  callee: string | null; reason: string; targetCallCount: number;
}
export interface ChainCallee {
  form: ChainForm; entryReads: number[];
  spills: Array<{ address: number; offset: number }>;
  savedRegisters: number[]; forwards: ChainCall[];
  allocationShadow: boolean; guidance: string; reasons: string[];
}
export interface ChainRow {
  id: string; function: string; container: string; start: number;
  callee: ChainCallee | null; callers: string[]; calls: ChainCall[];
  verdict: "paired" | "callee-only" | "caller-only" | "undetermined";
}
export interface ChainCensus {
  schemaVersion: 1; complete: boolean; scanned: number; findings: CensusFinding[];
  rows: ChainRow[];
}
const conditional = new Set(["beq", "bne", "blez", "bgtz", "bltz", "bgez"]);
const call = (i: MacroInstruction) => i.op === "jal" || i.op === "jalr";
const copies = new Set(["addu", "or", "add"]);
function copySource(i: MacroInstruction): number | null {
  if (!copies.has(i.op)) return null;
  const a = i.args[1]?.value, b = i.args[2]?.value;
  return a === 0 ? b ?? null : b === 0 ? a ?? null : null;
}
function frameOffset(i: MacroInstruction): number | null {
  if (i.op === "addiu" && i.args[0]?.value === 2 && i.args[1]?.value === 29) return i.args[2]!.value;
  if (i.writes[0] === 2 && copySource(i) === 29) return 0;
  return null;
}
const evidence = (i: MacroInstruction) => `${hex(i.vram)}: ${i.op} ${i.args.map(a => a.kind === "gpr" ? `$${REGISTER_NAMES[a.value]}` : a.kind === "address" ? hex(a.value) : a.value).join(", ")}`;

/** Walk the frame value to its first call boundary. Delay slots execute before
 * call clobbers; jalr $v0 consumes the value. Only straight fall-through and
 * resolved unconditional jumps are admitted after a branch-delay setup. */
function toCall(insns: MacroInstruction[], start: number): { index: number | null; verdict: "accepted" | "rejected" | "undetermined"; reason: string } {
  const visited = new Set<number>();
  for (let n = start; n < insns.length;) {
    if (n < 0 || visited.has(n)) return { index: null, verdict: "undetermined", reason: "cycle or out-of-function transfer before call" };
    visited.add(n);
    const i = insns[n]!;
    if (i.op === "unknown") return { index: null, verdict: "undetermined", reason: `opaque word at ${hex(i.vram)}` };
    if (i.reads.includes(2) || i.writes.includes(2)) return { index: null, verdict: "rejected", reason: `value consumed or redefined: ${evidence(i)}` };
    if (call(i)) {
      const slot = insns[n + 1];
      if (!slot || slot.control || slot.op === "unknown") return { index: null, verdict: "undetermined", reason: "missing or opaque call delay slot" };
      if (slot.reads.includes(2) || slot.writes.includes(2)) return { index: null, verdict: "rejected", reason: `call delay slot consumes or redefines value: ${evidence(slot)}` };
      return { index: n, verdict: "accepted", reason: "frame value dead at call boundary, including delay slot" };
    }
    if (i.control) {
      if (i.op !== "j" && !(i.op === "beq" && i.args[0]?.value === i.args[1]?.value))
        return { index: null, verdict: "undetermined", reason: `non-fall-through control before call: ${evidence(i)}` };
      const slot = insns[n + 1];
      if (!slot || slot.control || slot.op === "unknown") return { index: null, verdict: "undetermined", reason: "unknown jump delay slot" };
      if (slot.reads.includes(2) || slot.writes.includes(2)) return { index: null, verdict: "rejected", reason: `jump slot consumes or redefines value: ${evidence(slot)}` };
      n = insns.findIndex(x => x.vram === i.target);
    } else n++;
  }
  return { index: null, verdict: "rejected", reason: "no call before function exit" };
}
function callAfter(insns: MacroInstruction[], n: number, offset: number | null, placement: ChainCall["placement"]): ChainCall {
  const prev = insns[n - 1];
  let reached: ReturnType<typeof toCall>;
  if (prev && call(prev)) {
    reached = prev.reads.includes(2) ? { index: null, verdict: "rejected", reason: `call target consumes $v0: ${evidence(prev)}` } :
      { index: n - 1, verdict: "accepted", reason: "frame value in call delay slot" };
  } else if (prev?.control && !conditional.has(prev.op)) {
    reached = { index: null, verdict: "undetermined", reason: "setup in non-conditional control delay slot" };
  } else reached = toCall(insns, n + 1);
  const targetCall = reached.index === null ? null : insns[reached.index]!;
  return { setup: insns[n]!.vram, call: targetCall?.vram ?? insns[n]!.vram, target: targetCall?.target ?? null,
    offset, placement, verdict: reached.verdict === "accepted" ? "caller-candidate" : reached.verdict,
    callee: null, reason: reached.reason, targetCallCount: targetCall ? insns.filter(i => call(i) && i.target === targetCall.target).length : 0 };
}

/** Chain/other may-origin lattice. Delay slots are executed on their owner's
 * edge, not as independent CFG nodes. Calls clobber only after their slot. */
function incomingOrigins(insns: MacroInstruction[]): Array<number[] | null> {
  const states: Array<number[] | null> = insns.map(() => null);
  if (!insns.length) return states;
  states[0] = Array.from({ length: 32 }, (_, r) => r === 2 ? 1 : 2);
  const queue = [0], queued = new Set(queue);
  const at = new Map(insns.map((i, n) => [i.vram, n]));
  const merge = (n: number | undefined, state: number[]) => {
    if (n === undefined || n < 0 || n >= states.length) return;
    const old = states[n];
    const next = old ? old.map((v, r) => v | state[r]!) : [...state];
    if (!old || next.some((v, r) => old[r] !== v)) {
      states[n] = next;
      if (!queued.has(n)) { queue.push(n); queued.add(n); }
    }
  };
  const apply = (i: MacroInstruction, state: number[]) => {
    if (i.op === "unknown") { state.fill(3); state[0] = 2; return; }
    const source = copySource(i);
    const origin = source === null ? 2 : state[source]!;
    for (const r of i.writes) if (r !== 0) state[r] = origin;
  };
  while (queue.length) {
    const n = queue.shift()!; queued.delete(n);
    const i = insns[n]!, state = [...states[n]!];
    apply(i, state);
    if (!i.control) { merge(n + 1, state); continue; }
    const slot = insns[n + 1];
    if (!slot || slot.control) continue;
    mergeSlot(n + 1, state);
    apply(slot, state);
    if (call(i)) {
      for (const r of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 24, 25, 31]) state[r] = 2;
      merge(n + 2, state);
    } else if (conditional.has(i.op)) {
      merge(at.get(i.target!), state);
      if (!(i.op === "beq" && i.args[0]?.value === i.args[1]?.value)) merge(n + 2, state);
    } else if (i.op === "j") merge(at.get(i.target!), state);
  }
  return states;
  // Slots have incoming facts for classification, but never enter the queue.
  function mergeSlot(n: number, state: number[]) {
    states[n] = states[n] ? states[n]!.map((v, r) => v | state[r]!) : [...state];
  }
}

export function scanChainFunction(fn: MacroFunction): { callee: ChainCallee | null; calls: ChainCall[] } {
  const insns = decodeMacroBytes(fn.bytes, fn.vram);
  const origins = incomingOrigins(insns);
  const reads = insns.filter((i, n) => i.reads.includes(2) && origins[n]?.[2] === 1);
  const calls = insns.flatMap((i, n) => {
    const offset = frameOffset(i);
    if (offset === null) return [];
    const prev = insns[n - 1];
    // Architectural $sp+K staging can occur anywhere, but only the documented
    // placements are injection evidence. Others remain surfaced candidates.
    const placement = prev && call(prev) ? "call-delay" : prev && conditional.has(prev.op) ? "branch-delay" : "before-call";
    return [callAfter(insns, n, offset, placement)];
  });
  if (!reads.length) return { callee: null, calls };
  const savedRegisters = [...new Set(reads.filter(i => copySource(i) === 2 && i.writes[0]! >= 16 && i.writes[0]! <= 23).map(i => i.writes[0]!))];
  const forwards = insns.flatMap((i, n) => {
    if (i.writes[0] !== 2 || !savedRegisters.includes(copySource(i) ?? -1) || origins[n]?.[copySource(i)!] !== 1) return [];
    // A sibling forward can survive a guard on either edge. Unlike caller
    // setup, it is tied to a proven saved-entry web, not a frame-address guess.
    const destinations = new Set<number>(), seen = new Set<number>();
    const at = new Map(insns.map((x, k) => [x.vram, k]));
    const visit = (k: number | undefined): void => {
      if (k === undefined || seen.has(k) || !insns[k]) return;
      seen.add(k);
      const x = insns[k]!;
      if (x.op === "unknown" || x.reads.includes(2) || x.writes.includes(2)) return;
      if (x.control) {
        const slot = insns[k + 1];
        if (!slot || slot.control || slot.op === "unknown" || slot.reads.includes(2) || slot.writes.includes(2)) return;
        if (call(x)) { destinations.add(k); return; }
        if (x.op === "j" || conditional.has(x.op)) visit(at.get(x.target!));
        if (conditional.has(x.op) && !(x.op === "beq" && x.args[0]?.value === x.args[1]?.value)) visit(k + 2);
      } else visit(k + 1);
    };
    const prev = insns[n - 1];
    if (prev?.control) {
      if (conditional.has(prev.op) || prev.op === "j") visit(at.get(prev.target!));
      if (conditional.has(prev.op)) visit(n + 1);
      if (call(prev) && !prev.reads.includes(2)) destinations.add(n - 1);
    } else visit(n + 1);
    return [...destinations].map(k => ({ setup: i.vram, call: insns[k]!.vram, target: insns[k]!.target,
      offset: null, placement: "forward" as const, verdict: "caller-candidate" as const, callee: null,
      reason: "saved entry-$2 web re-installed and reaches sibling call without a read/definition",
      targetCallCount: insns.filter(x => call(x) && x.target === insns[k]!.target).length }));
  });
  const spills = insns.flatMap((i, n) => i.op === "sw" && i.args[2]?.value === 29 && origins[n]?.[i.args[0]!.value] === 1 ?
    [{ address: i.vram, offset: i.args[1]!.value }] : []);
  // Exact stack-slot non-read proof is conservative: any stack escape or
  // non-entry sp change prevents calling it dead; indexed/aliased reads are
  // not assumed absent simply because no lw uses the literal offset.
  const stackAdjustments = insns.filter(i => i.op === "addiu" && i.writes[0] === 29 && i.args[1]?.value === 29);
  const firstAdjustment = stackAdjustments[0];
  const stackEscapes = stackAdjustments.filter(i => i.args[2]!.value < 0).length > 1 ||
    insns.some(i => i.reads.includes(29) && !i.memory &&
      !(i.op === "addiu" && i.writes[0] === 29 && (i === firstAdjustment || i.args[2]!.value > 0)));
  const reload = spills.some(s => insns.some(i => i.op.startsWith("l") && i.memory && i.args[2]?.value === 29 &&
    Math.abs(i.args[1]!.value - s.offset) < 4));
  const opaque = insns.some(i => i.op === "unknown");
  const reasons: string[] = [];
  const liveForward = forwards.filter(f => f.verdict === "caller-candidate");
  const form: ChainForm = liveForward.length ? "save-forward" : spills.length && !reload && !stackEscapes && !opaque &&
    reads.every(i => i.op === "sw" && i.args[2]?.value === 29) ? "dead-spill" : "undetermined";
  if (form === "undetermined") reasons.push("entry-$2 proven, but spill non-read or save/forward recipe not established");
  if (reload) reasons.push("captured stack slot may be read");
  if (stackEscapes) reasons.push("stack address escapes or stack base changes");
  if (opaque) reasons.push("opaque word prevents complete body proof");
  const guidance = form === "dead-spill" ? "CAPTURE_PREV_RET(phantom) at block top, then a target-slot dead spill; verify compiled offset." :
    form === "save-forward" ? "CAPTURE_PREV_RET(phantom) at file scope before this function; save the entry value and re-install before the evidenced sibling calls. Scaffold needs positioning and oracle verification." :
    "Entry-$2 liveness requires CAPTURE_PREV_RET; scope/body recipe ambiguous: surface without guessing sub-form.";
  return { calls, callee: { form, entryReads: reads.map(i => i.vram), spills, savedRegisters, forwards,
    allocationShadow: !insns.some((i, n) => i.writes.includes(2) && !call(i) && origins[n]?.[2] === 2 && i.op !== "addiu" && copySource(i) === null), guidance, reasons } };
}

export function buildChainCensus(functions: readonly MacroFunction[], findings: CensusFinding[] = [], complete = true): ChainCensus {
  const rows: ChainRow[] = functions.map(fn => ({ id: `${fn.container}:${fn.name}`, function: fn.name, container: fn.container, start: fn.vram,
    ...scanChainFunction(fn), callers: [], verdict: "undetermined" }));
  const index = new Map(rows.map(r => [`${r.container}:${r.start}`, r]));
  for (const row of rows) for (const c of [...row.calls, ...row.callee?.forwards ?? []]) {
    if (c.verdict !== "caller-candidate") continue;
    const target = index.get(`${row.container}:${c.target}`) ?? (row.container !== "exe" ? index.get(`exe:${c.target}`) : undefined);
    c.callee = target?.function ?? null;
    if (target?.callee && target.callee.form !== "undetermined") {
      c.verdict = "confirmed-pair"; target.callers.push(row.id);
    } else if (target?.callee) { c.verdict = "undetermined"; c.reason += "; callee entry-$2 has ambiguous sub-form"; }
    else c.reason += target ? "; callee has no entry-$2 fingerprint" : "; target function unavailable";
  }
  for (const row of rows) {
    row.callers = [...new Set(row.callers)];
    const positive = [...row.calls, ...row.callee?.forwards ?? []].filter(c => c.verdict !== "rejected");
    row.verdict = row.callee?.form === "undetermined" || positive.some(c => c.verdict === "undetermined") ? "undetermined" :
      row.callers.length || positive.some(c => c.verdict === "confirmed-pair") ? "paired" :
      row.callee ? complete && !findings.length ? "callee-only" : "undetermined" : "caller-only";
  }
  return { schemaVersion: 1, complete: complete && !findings.length, scanned: functions.length, findings,
    rows: rows.filter(r => r.callee || r.calls.length) };
}
export function nestedFunctionCensus(): ChainCensus {
  const loaded = loadMacroFunctions(loadContainers());
  const findings = [...loaded.findings, ...unresolvedCodeMembers().map(m => ({ container: m.id, function: null, reason: "Unresolved code container; not scanned" }))];
  return buildChainCensus(loaded.functions, findings);
}
export function chainRow(census: ChainCensus, name: string): ChainRow | null {
  return census.rows.find(r => r.function === name) ?? null;
}
export function formatChainCensus(report: ChainCensus): string {
  return [`Static-chain census: ${report.scanned} functions; coverage ${report.complete ? "complete" : "incomplete"}.`,
    ...report.findings.map(f => `${f.container}: ${f.reason}`),
    ...report.rows.map(r => `${r.id}: ${r.verdict}; ${r.callee?.form ?? "caller"}\n` +
      (r.callee ? `  ${r.callee.entryReads.map(hex).join(", ")}: ${r.callee.guidance}\n  callers: ${r.callers.join(", ") || "none found"}\n` : "") +
      [...r.calls, ...r.callee?.forwards ?? []].map(c => `  ${hex(c.setup)} -> ${hex(c.call)} ${c.callee ?? (c.target === null ? "unknown" : hex(c.target))}: ${c.verdict}; K=${c.offset}; ${c.reason}`).join("\n"))].join("\n");
}
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const args = process.argv.slice(2);
  if (args.some(a => !["--json", "--write"].includes(a))) throw new Error("Usage: npx tsx tools/diagnostics/nestedFunctionScan.ts [--json] [--write]");
  const report = nestedFunctionCensus();
  if (args.includes("--write")) { mkdirSync(join(ROOT, "build"), { recursive: true }); writeFileSync(join(ROOT, "build/nestedFunctionCensus.json"), JSON.stringify(report, null, 2) + "\n"); }
  console.log(args.includes("--json") ? JSON.stringify(report, null, 2) : formatChainCensus(report));
}
