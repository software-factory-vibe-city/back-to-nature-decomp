#!/usr/bin/env npx tsx
/** Dump-pair attribution, not a log of jump.c's private decisions. */
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { ROOT, compileSource, normalizeFunctionName, resolveSource } from "./decompToolchain.js";
import { projectPath, sha256, writeStableJson } from "./provenance.js";
import { parseRtlInstructions } from "./compiler-trace/rtl-parser.js";

export type JumpRewrite = "assignment-hoist" | "else-hoist" | "store-flag-fold" | "unchanged" | "undetermined";
export interface JumpChange {
  uid: number;
  classification: JumpRewrite;
  rule?: string;
  condition: string;
  before: string;
  after?: string;
  resultRegister?: number;
  machineComparison?: string;
  evidence: string[];
}
export const JUMP_BLOCKERS = [
  "jump.c:596 needs the test's target label directly after the guarded arm's goto, with no label between the test and that goto. An extra arm returning the same value can block it.",
  "jump.c:453 moves the else assignment before a chain of tests to one label only without intervening entries or data conflicts.",
  "jump.c:870/:1021 needs the guarded SET immediately after the jump and a suitable prior value. reg_set_last stops at a label; for the Boolean constant fold that prevents discovering the prior constant.",
];
export interface JumpTraceReport {
  functionName: string;
  source?: string;
  sourceHash?: string;
  cc1Flags?: string[];
  directory?: string;
  passes: Array<{ before: string; after: string; changes: JumpChange[] }>;
  blockers: string[];
  caveats: string[];
}
interface Item { uid: number; kind: string; text: string; expression?: string; register?: number; }
interface Branch { code: string; operands: string; label: number; }
const REVERSE: Record<string, string> = { eq: "ne", ne: "eq", lt: "ge", ge: "lt", le: "gt", gt: "le", ltu: "geu", geu: "ltu", leu: "gtu", gtu: "leu" };
const compact = (text: string) => text.replace(/\s+/g, " ").trim();
const norm = (text: string) => compact(text).replace(/\(reg(?:\/[a-z]+)*:([A-Z]+) (\d+)(?: [^()]*)?\)/g, "(reg:$1 $2)").replace(/ \[0x[\da-f]+\]/gi, "");
function section(dump: string, fn: string): string {
  const sections = dump.split(/^;; Function /m).slice(1);
  const found = sections.filter(part => part.split(/\s/)[0] === fn);
  if (found.length !== 1) throw new Error(`expected one RTL section for ${fn}, found ${found.length}`);
  return found[0]!;
}
function items(dump: string): Item[] {
  const parsed = new Map(parseRtlInstructions(dump, "jump-trace").map(insn => [insn.uid, insn]));
  const starts = [...dump.matchAll(/^\((note|insn|jump_insn|call_insn|code_label|barrier)(?:\/[a-z]+)*\s+(\d+)\b/gm)];
  return starts.map((match, i) => {
    const uid = Number(match[2]), insn = parsed.get(uid);
    return { uid, kind: match[1]!, text: dump.slice(match.index!, starts[i + 1]?.index ?? dump.length).trim(),
      /* The shared diagnostic parser truncates display expressions at 240.
         Such a display is not a structural witness. */
      ...(insn?.expression && insn.expression.length < 240 ? { expression: norm(insn.expression) } : {}),
      ...(insn?.sets.length === 1 ? { register: insn.sets[0]!.register } : {}) };
  });
}
function branch(item: Item): Branch | undefined {
  const match = item.expression?.match(/^\(if_then_else \(([a-z]+):[A-Z]+ (.*)\) \(label_ref(?:\/[a-z]+)* (\d+)\) \(pc\)\)$/);
  return match ? { code: match[1]!, operands: match[2]!, label: Number(match[3]) } : undefined;
}
function goto(item: Item): number | undefined {
  const match = item.expression?.match(/^\(label_ref(?:\/[a-z]+)* (\d+)\)$/);
  return match ? Number(match[1]) : undefined;
}
function active(list: Item[]): Item[] {
  return list.filter(item => item.kind !== "note" && item.kind !== "barrier" && !/\(use /.test(item.text));
}
function endpoint(list: Item[], label: number, seen = new Set<number>()): string | undefined {
  if (seen.has(label)) return undefined;
  seen.add(label);
  const index = list.findIndex(item => item.kind === "code_label" && item.uid === label);
  if (index < 0) return undefined;
  const next = active(list.slice(index + 1)).find(item => item.kind !== "code_label");
  const destination = next ? goto(next) : undefined;
  if (destination !== undefined) return endpoint(list, destination, seen);
  return next ? `${next.kind}:${next.uid}` : "end";
}
function sameEndpoint(left: Item[], a: number, right: Item[], b: number): boolean {
  const end = endpoint(left, a);
  return end !== undefined && end === endpoint(right, b);
}
function constant(item: Item | undefined): number | undefined {
  const match = item?.expression?.match(/^\(const_int (-?\d+)\)$/);
  return match ? Number(match[1]) : undefined;
}
/** Boolean relation tree, expanding only straight-line register definitions. */
function value(expr: string, defs: Map<number, string>, depth = 0): string {
  if (depth > 12) return expr;
  const reg = expr.match(/^\(reg:[A-Z]+ (\d+)\)$/);
  if (reg && defs.has(Number(reg[1]))) return value(defs.get(Number(reg[1]))!, defs, depth + 1);
  const expanded = expr.replace(/\(reg:[A-Z]+ (\d+)\)/g, (whole, id) => defs.has(Number(id)) ? value(defs.get(Number(id))!, defs, depth + 1) : whole);
  const xor = expanded.match(/^\(xor:[A-Z]+ (.*) \(const_int 0\)\)$/);
  if (xor) return xor[1]!;
  const zero = expanded.match(/^\(ltu:[A-Z]+ (.*) \(const_int 1\)\)$/);
  if (zero) return `(eq:SI ${zero[1]} (const_int 0))`;
  return expanded;
}

/** Conservative structural witnesses. Anything else stays undetermined. */
export function classifyJumpPair(beforeDump: string, afterDump: string, functionName: string): JumpChange[] {
  const before = active(items(section(beforeDump, functionName))), after = active(items(section(afterDump, functionName)));
  const changes: JumpChange[] = [];
  for (const [index, test] of before.entries()) {
    const b = branch(test);
    if (!b) continue;
    const afterIndex = after.findIndex(item => item.uid === test.uid && item.kind === "jump_insn"), replacement = after[afterIndex];
    const a = replacement ? branch(replacement) : undefined;
    const change: JumpChange = { uid: test.uid, classification: "undetermined", condition: `(${b.code}:SI ${b.operands})`, before: test.text, evidence: [] };
    if (replacement) change.after = replacement.text;
    const setA = before[index + 1], jump = before[index + 2];
    const gotoLabel = jump ? goto(jump) : undefined;
    const targetIndex = before.findIndex(item => item.kind === "code_label" && item.uid === b.label);
    const setB = before.slice(targetIndex + 1).find(item => item.kind !== "code_label");
    const armPair = setA?.register !== undefined && setA.register === setB?.register && constant(setA) !== undefined && constant(setB) !== undefined;
    const skipArm = gotoLabel !== undefined && targetIndex > index + 2 && before.slice(index + 3, targetIndex + 1).every(item => item.kind === "code_label");
    if (a && armPair && skipArm) {
      const hoisted = after.slice(0, afterIndex).reverse().find(item => item.kind !== "code_label");
      if (hoisted && hoisted.register === setA!.register && hoisted.expression === setA!.expression && a.code === REVERSE[b.code] && a.operands === b.operands &&
          (a.label === gotoLabel || sameEndpoint(after, a.label, before, gotoLabel!))) {
        change.classification = "assignment-hoist"; change.rule = "jump.c:596"; change.resultRegister = setA!.register!;
        change.evidence.push(`SET r${setA!.register} = ${setA!.expression} moved before UID ${test.uid}; ${b.code} -> ${a.code}; target redirected to the guarded goto's destination.`);
      }
    }
    if (a && change.classification === "undetermined") {
      /* A compound condition can be a contiguous chain of tests to the same
         else label. Moving B ahead of the *whole* chain is the :453 witness,
         not necessarily the instruction just before this individual test. */
      let first = index, last = index;
      while (first > 0 && branch(before[first - 1]!)?.label === b.label) first--;
      while (branch(before[last + 1] ?? test)?.label === b.label && last + 1 < before.length) last++;
      const arm = before[last + 1], around = before[last + 2], destination = around ? goto(around) : undefined;
      const leading = after.findIndex(i => i.uid === before[first]!.uid);
      const moved = after[leading - 1];
      if (arm?.register !== undefined && arm.register === setB?.register && constant(arm) !== undefined && constant(setB) !== undefined &&
          destination !== undefined && targetIndex === last + 3 && moved?.register === setB!.register && moved.expression === setB!.expression &&
          !after.some(i => i.uid === around!.uid) && !after.some(i => i.uid === setB!.uid) &&
          before.slice(first, last + 1).every(i => !i.expression?.includes(`(reg:SI ${arm.register})`)) &&
          a.code === b.code && a.operands === b.operands && (a.label === destination || sameEndpoint(after, a.label, before, destination))) {
        change.classification = "else-hoist"; change.rule = "jump.c:453"; change.resultRegister = arm.register;
        change.evidence.push(`Else SET r${arm.register} = ${setB!.expression} moved before the whole UID ${before[first]!.uid}..${before[last]!.uid} test chain; the guarded goto and original else SET disappeared.`);
      }
    }
    if (!a && armPair && REVERSE[b.code] && new Set([constant(setA), constant(setB)]).has(0) && new Set([constant(setA), constant(setB)]).has(1)) {
      /* Keep the tested operands as leaves. Only new/local copy/flag SETs may
         explain their replacement; an arbitrary earlier value is no witness. */
      const leaves = new Set([...b.operands.matchAll(/\(reg:[A-Z]+ (\d+)\)/g)].map(match => Number(match[1])));
      const previous = before.slice(0, index).reverse().find(item => item.kind === "insn");
      const anchor = previous ? after.findIndex(item => item.uid === previous.uid) : -1;
      const defs = new Map<number, string>();
      const expected = `(${constant(setA) === 1 ? REVERSE[b.code] : b.code}:SI ${b.operands})`;
      for (const item of after.slice(anchor + 1)) {
        if (item.kind === "code_label" || item.kind === "jump_insn" || item.kind === "call_insn") break;
        if (item.register === undefined || !item.expression) continue;
        const computed = value(item.expression, defs);
        if (item.register === setA!.register && computed === expected) {
          change.classification = "store-flag-fold"; change.rule = "jump.c:870/:1021"; change.resultRegister = item.register; change.after = item.text;
          change.evidence.push(`Conditional UID ${test.uid} disappeared; SET r${item.register} computes ${computed} for the same guarded 0/1 assignments.`,
            "An assignment hoist preceding this fold inside the same pass is not observable between these dumps; no intermediate hoist is attributed.");
          break;
        }
        if (!leaves.has(item.register)) defs.set(item.register, computed);
      }
    }
    if (change.classification === "undetermined" && a && a.code === b.code && a.operands === b.operands &&
        (a.label === b.label || sameEndpoint(after, a.label, before, b.label))) {
      change.classification = "unchanged"; change.evidence.push("Same comparison, branch sense and destination (allowing label aliases); no witnessed assignment hoist.");
    }
    if (change.classification === "undetermined") {
      change.evidence.push("The dump pair fits no supported rewrite witness. No pass-internal history is inferred.");
      if (a && a.code === REVERSE[b.code] && a.operands === b.operands && goto(before[index + 1] ?? test) === a.label) {
        change.evidence.push("Observed jump-over-jump inversion and deletion of the following goto (the shape handled at jump.c:1733); no SET moved before the test, so this is NOT an assignment-hoist witness.");
      }
    }
    changes.push(change);
  }
  return changes;
}
export function jumpTraceFromDumps(functionName: string, dumps: Record<string, string>): JumpTraceReport {
  const pairs: Array<[string, string]> = [["rtl", "jump"], ["jump", "cse"], ["cse", "gcse"], ["loop", "cse2"], ["sched2", "jump2"]];
  const passes = pairs.filter(([a, b]) => dumps[a] !== undefined && dumps[b] !== undefined).map(([a, b]) =>
    ({ before: a, after: b, changes: classifyJumpPair(dumps[a]!, dumps[b]!, functionName) }));
  /* Bind a survived UID to its final hard-register comparison. A unique
     return rewrite elsewhere in the function is not a binding. */
  if (dumps.jump2) {
    const final = items(section(dumps.jump2, functionName));
    const signature = (item: Item): string | undefined => {
      const b = branch(item);
      const zero = b?.operands.match(/^\(reg:SI (\d+)\) \(const_int 0\)$/);
      if (b && zero) return `${b.code}:r${zero[1]}:0`;
      const flag = item.expression?.match(/^\(ltu:SI \(reg:SI (\d+)\) \(const_int 1\)\)$/);
      return flag && item.register === 2 ? `flag-eq:r${flag[1]}` : undefined;
    };
    for (const change of passes[0]?.changes ?? []) {
      const uid = change.classification === "store-flag-fold" ? Number(change.after?.match(/^\(insn(?:\/[a-z]+)* (\d+)/)?.[1]) : change.uid;
      const item = final.find(i => i.uid === uid), key = item ? signature(item) : undefined;
      if (key && final.filter(i => signature(i) === key).length === 1) change.machineComparison = key;
    }
  }
  return { functionName, passes, blockers: JUMP_BLOCKERS,
    caveats: ["Attribution is structural dump-pair evidence, not jump.c logging. Intermediate rewrites inside a pass are unobserved. Expressions truncated by the shared display parser are not witnesses.",
      "jump -> cse, cse -> gcse and loop -> cse2 include CSE/GCSE as well as jump optimization; their witnesses do not uniquely attribute a pass."] };
}
export function jumpTrace(functionName: string, sourceOverride?: string): JumpTraceReport {
  const source = resolveSource(functionName, sourceOverride), text = readFileSync(source, "utf8");
  const directory = join(ROOT, "build/jumpTrace", functionName, sha256(text).slice(0, 24));
  mkdirSync(directory, { recursive: true });
  /* GCC appends dumps. Never read an old function section as a fresh compile. */
  for (const file of readdirSync(directory)) if (file.startsWith(`${functionName}.i.`)) rmSync(join(directory, file));
  const compiled = compileSource(source, directory, functionName, { dumps: true });
  const dumps: Record<string, string> = {};
  for (const stage of ["rtl", "jump", "cse", "gcse", "loop", "cse2", "sched2", "jump2"]) {
    const path = join(directory, `${functionName}.i.${stage}`);
    if (existsSync(path)) dumps[stage] = readFileSync(path, "utf8");
  }
  if (!dumps.rtl || !dumps.jump) throw new Error(`no expand/jump dump for ${functionName}; supply compiled C, not an assembly stub`);
  const report = { ...jumpTraceFromDumps(functionName, dumps), source: projectPath(source), sourceHash: sha256(text), cc1Flags: compiled.cc1Flags, directory: projectPath(directory) };
  writeStableJson(join(directory, "report.json"), report);
  return report;
}
export function renderJumpTrace(report: JumpTraceReport): string {
  return [`jump trace: ${report.functionName} (${report.source ?? "preserved dumps"})`, ...report.passes.flatMap(pass =>
    [`${pass.before} -> ${pass.after}`, ...pass.changes.map(change => `  UID ${change.uid}: ${change.classification}${change.rule ? ` (${change.rule})` : ""} — ${change.condition}\n    ${change.evidence.join("\n    ")}`)]),
    "Source rewrite blockers:", ...report.blockers.map(line => `  ${line}`), ...report.caveats.map(line => `CAVEAT: ${line}`)].join("\n");
}
function main(): void {
  try {
    const args = process.argv.slice(2); let fn: string | undefined, source: string | undefined; let json = false;
    for (let i = 0; i < args.length; i++) {
      if (args[i] === "--json") json = true;
      else if (args[i] === "--source") { source = args[++i]; if (!source) throw new Error("--source needs a path"); }
      else if (args[i]!.startsWith("--") || fn) throw new Error(`unexpected argument ${args[i]}`); else fn = normalizeFunctionName(args[i]!);
    }
    if (!fn) throw new Error("name one function");
    const report = jumpTrace(fn, source); console.log(json ? JSON.stringify(report, null, 2) : renderJumpTrace(report));
  } catch (error) { console.error(`jumpTrace: ${(error as Error).message}\nUsage: npx tsx tools/agent/jumpTrace.ts <fn> [--source path] [--json]`); process.exitCode = 1; }
}
if (import.meta.url === `file://${process.argv[1]}`) main();
