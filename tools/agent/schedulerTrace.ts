#!/usr/bin/env npx tsx
/**
 * The scheduler's own account of why a block came out in the order it did.
 *
 * The configured compiler already prints, per basic block, every insn's
 * priority and the ready list it chose from at each cycle. `gcc/sched.c`
 * emits it whenever an RTL dump file exists, so it is present in every `-da`
 * dump this project has ever written — no extra flag, no special compile.
 * (`-fsched-verbose-N` belongs to `haifa-sched.c` and this cc1 rejects it,
 * which is itself confirmation of which scheduler is running.) It sat unread
 * in `build/compilerTrace/` artifacts for the life of the project; this tool
 * is the reader.
 *
 * That makes it a measurement of the decision rather than an inference from
 * the emitted code. Reach for it as soon as a residual is classified as
 * scheduling: enumerating source spellings cannot distinguish two shapes that
 * compile to the same RTL, and this report names the lever that actually
 * moved.
 *
 * Two facts about the machine being reported, because reading the wrong pass
 * models the wrong compiler:
 *
 *  - This configuration schedules with `gcc/sched.c`, not `haifa-sched.c`.
 *    Both files define a `rank_for_schedule`; they are different functions.
 *    The dump format below (`ready list at T-N`, `LAUNCH_PRIORITY`, "greater
 *    potential hazard") belongs to `sched.c` alone.
 *  - `sched.c` schedules a block BOTTOM-UP. T counts down to the block's last
 *    insn, so the insn chosen at the highest T is emitted first. An insn that
 *    keeps losing priority contests therefore drifts to the TOP of the block.
 *
 * Usage:
 *   npx tsx tools/agent/schedulerTrace.ts <func> [--src <file>]
 *                                         [--pass sched|sched2|both] [--block <n>] [--json]
 */

import { existsSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";
import {
  ROOT,
  compileSource,
  normalizeFunctionName,
  resolveSource,
} from "./decompToolchain.js";

/* sched.c's own constants (gcc/sched.c). LOW_PRIORITY_P is the compiler's
 * predicate for "this insn never got the birthing promotion", so classify with
 * it rather than with a threshold of our own invention. */
const PRIORITY_CLASS_MASK = 0x7f000000;
const LAUNCH_PRIORITY = 0x7f000001;
const TAIL_PRIORITY = 0x7ffffffe;

interface Choice {
  cycle: number;
  /** Ready list as first printed, in dump order: [uid, priority] pairs. */
  ready: Array<{ uid: number; priority: number }>;
  chosen: number;
  /** Set when a function-unit hazard reordered the sorted ready list. */
  hazardReorder?: number;
  notes: string[];
}

interface Block {
  index: number;
  from: number;
  to: number;
  priorities: Map<number, { priority: number; refCount: number }>;
  choices: Choice[];
  totalTime?: number;
}

export interface SchedulerTraceReport {
  functionName: string;
  source: string;
  pass: string;
  cc1Flags: string[];
  blocks: Array<{
    index: number;
    emitted: Array<{
      position: number;
      uid: number;
      priority: number;
      promoted: boolean;
      rtl: string;
      reason: string;
    }>;
    unpromoted: number[];
  }>;
}

function parseBlocks(dump: string): Block[] {
  const blocks: Block[] = [];
  let current: Block | undefined;
  let pendingChoice: Choice | undefined;

  const finishChoice = () => {
    if (current && pendingChoice) current.choices.push(pendingChoice);
    pendingChoice = undefined;
  };

  for (const line of dump.split("\n")) {
    if (!line.startsWith(";;")) {
      /* The verbose trace precedes the RTL body; the first non-`;;` insn line
       * ends it. Keep scanning: later blocks are all in the same prelude. */
      continue;
    }

    const header = line.match(/-- basic block number (\d+) from (\d+) to (\d+) --/);
    if (header) {
      finishChoice();
      current = {
        index: Number(header[1]),
        from: Number(header[2]),
        to: Number(header[3]),
        priorities: new Map(),
        choices: [],
      };
      blocks.push(current);
      continue;
    }
    if (!current) continue;

    const priority = line.match(/insn\[\s*(\d+)\]:\s*priority\s*=\s*(-?\d+),\s*ref_count\s*=\s*(-?\d+)/);
    if (priority) {
      current.priorities.set(Number(priority[1]), {
        priority: Number(priority[2]),
        refCount: Number(priority[3]),
      });
      continue;
    }

    const ready = line.match(/ready list at T-(\d+):(.*?), now (.*)$/);
    if (ready) {
      finishChoice();
      const entries: Array<{ uid: number; priority: number }> = [];
      for (const match of ready[2].matchAll(/(\d+)\s*\(([0-9a-f]+)\)/g)) {
        entries.push({ uid: Number(match[1]), priority: Number.parseInt(match[2], 16) });
      }
      const order = ready[3].trim().split(/\s+/).map(Number).filter((value) => !Number.isNaN(value));
      pendingChoice = { cycle: Number(ready[1]), ready: entries, chosen: order[0]!, notes: [] };
      continue;
    }

    const hazard = line.match(/insn (\d+) has a greater potential hazard, now (.*)$/);
    if (hazard && pendingChoice) {
      const order = hazard[2].trim().split(/\s+/).map(Number).filter((value) => !Number.isNaN(value));
      pendingChoice.hazardReorder = Number(hazard[1]);
      pendingChoice.chosen = order[0]!;
      pendingChoice.notes.push(`function-unit hazard moved insn ${hazard[1]} ahead of the sorted order`);
      continue;
    }

    const launching = line.match(/launching (\d+) before (\d+) with no stalls at T-(\d+)/);
    if (launching && pendingChoice) {
      pendingChoice.notes.push(`launched ${launching[1]} before ${launching[2]} with no stalls`);
      continue;
    }

    const total = line.match(/total time = (\d+)/);
    if (total) {
      finishChoice();
      current.totalTime = Number(total[1]);
    }
  }
  finishChoice();
  return blocks;
}

/**
 * One-line summary of an RTL insn, from the dump's own body. Best-effort by
 * design: an unrecognised pattern prints its raw head rather than a guess.
 */
function parseRtlSummaries(dump: string): Map<number, string> {
  const summaries = new Map<number, string>();
  const lines = dump.split("\n");
  for (let index = 0; index < lines.length; index++) {
    const head = lines[index]!.match(/^\((insn|jump_insn|call_insn)\s+(\d+)\s+\d+\s+\d+\s+(.*)$/);
    if (!head) continue;
    let body = head[3]!;
    for (let scan = index + 1; scan < lines.length && !lines[scan]!.startsWith("("); scan++) {
      if (!lines[scan]!.trim()) break;
      body += " " + lines[scan]!.trim();
    }
    summaries.set(Number(head[2]), summarize(head[1]!, body));
  }
  return summaries;
}

/**
 * Read one balanced parenthesised expression starting at `start`, which must
 * index the opening paren. Returns the expression and the index just past it.
 * RTL dumps nest, so regex slicing mis-attributes operands; this does not.
 */
function sexp(text: string, start: number): { body: string; end: number } | undefined {
  if (text[start] !== "(") return undefined;
  let depth = 0;
  let inString = false;
  for (let index = start; index < text.length; index++) {
    const character = text[index]!;
    if (inString) {
      if (character === '"' && text[index - 1] !== "\\") inString = false;
      continue;
    }
    if (character === '"') inString = true;
    else if (character === "(") depth++;
    else if (character === ")") {
      depth--;
      if (depth === 0) return { body: text.slice(start, index + 1), end: index + 1 };
    }
  }
  return undefined;
}

/** Top-level children of an RTL expression, in order. */
function children(expression: string): string[] {
  const inner = expression.slice(1, -1);
  const result: string[] = [];
  for (let index = 0; index < inner.length; index++) {
    if (inner[index] !== "(") continue;
    const child = sexp(inner, index);
    if (!child) break;
    result.push(child.body);
    index = child.end - 1;
  }
  return result;
}

function operand(expression: string): string {
  const code = expression.match(/^\((\w+)/)?.[1];
  if (code === "reg") return `r${expression.match(/^\(reg[^\s]*\s+(\d+)/)?.[1] ?? "?"}`;
  if (code === "const_int") return expression.match(/const_int (-?\d+)/)?.[1] ?? "?";
  if (code === "symbol_ref") return expression.match(/\("([^"]+)"\)/)?.[1] ?? "sym";
  if (code === "label_ref") return "label";
  if (code === "mem") return "mem";
  if (code === "const") {
    const parts = children(expression)[0];
    return parts ? operand(parts) : "const";
  }
  return code ?? "?";
}

function summarize(kind: string, body: string): string {
  if (kind === "jump_insn") return "jump";
  if (kind === "call_insn") return "call";

  const collapsed = body.replace(/\s+/g, " ").trim();
  const setStart = collapsed.indexOf("(set ");
  if (setStart < 0) {
    const code = collapsed.match(/^\((\w+)/)?.[1];
    return code === "use" || code === "clobber" ? code : collapsed.slice(0, 48);
  }
  const set = sexp(collapsed, setStart);
  if (!set) return collapsed.slice(0, 48);
  const parts = children(set.body);
  if (parts.length < 2) return collapsed.slice(0, 48);

  const [dest, source] = parts as [string, string];
  if (dest.startsWith("(mem")) {
    const base = children(dest)[0];
    return base ? `store [${operand(base)}]` : "store";
  }
  const target = operand(dest);

  const code = source.match(/^\((\w+)/)?.[1];
  if (code === "reg" || code === "const_int" || code === "symbol_ref" || code === "mem" || code === "const") {
    return `${target} = ${operand(source)}`;
  }
  const args = children(source).map(operand);
  return `${target} = ${code}(${args.join(", ")})`;
}

function promoted(priority: number): boolean {
  return (priority & PRIORITY_CLASS_MASK) !== 0;
}

function priorityLabel(priority: number): string {
  if (priority === LAUNCH_PRIORITY) return "promoted";
  if (priority >= TAIL_PRIORITY - 0x10000) return "block tail";
  if (promoted(priority)) return `promoted(0x${priority.toString(16)})`;
  return `plain(${priority})`;
}

function reasonFor(choice: Choice): string {
  if (choice.hazardReorder === choice.chosen) return "function-unit hazard";
  const sorted = [...choice.ready].sort((a, b) => b.priority - a.priority);
  if (choice.ready.length === 1) return "only candidate";
  if (sorted[0]!.uid === choice.chosen && sorted[0]!.priority !== sorted[1]!.priority) return "highest priority";
  return "tie broken by original position";
}

function render(report: SchedulerTraceReport, blockFilter?: number): string {
  const out: string[] = [];
  out.push(`schedulerTrace ${report.functionName} — pass .${report.pass}`);
  out.push(`source: ${report.source}`);
  out.push(`cc1:    ${report.cc1Flags.join(" ")}`);
  out.push("");
  out.push("gcc/sched.c schedules bottom-up: T counts down to the block's last");
  out.push("insn, so an insn that keeps losing priority contests drifts to the TOP");
  out.push("of the block. Positions below are emitted order, first to last.");
  out.push("");

  for (const block of report.blocks) {
    if (blockFilter !== undefined && block.index !== blockFilter) continue;
    out.push(`Block ${block.index} — ${block.emitted.length} insn(s)`);
    for (const insn of block.emitted) {
      const uid = String(insn.uid).padStart(4);
      out.push(`  ${String(insn.position).padStart(2)}. ${uid}  ${priorityLabel(insn.priority).padEnd(16)} ${insn.rtl.padEnd(34)} ${insn.reason}`);
    }
    if (block.unpromoted.length) {
      out.push("");
      out.push(`  Unpromoted in this block: ${block.unpromoted.join(", ")}`);
    }
    out.push("");
  }

  out.push("Reading the priority column:");
  out.push("  sched.c's adjust_priority raises an insn to max_priority when");
  out.push("  birthing_insn_p accepts it: the insn sets a register that is live");
  out.push("  here AND whose pseudo is set exactly once in the function");
  out.push("  (REG_N_SETS == 1). Its REG_DEAD demotion arm is dead code — the");
  out.push("  notes are gone by then — so promotion is the only adjustment that");
  out.push("  fires. A store promotes nothing (no register destination).");
  out.push("");
  out.push("  So a plain(N) non-store insn is usually a pseudo assigned more than");
  out.push("  once. In C that is a variable written twice — a pointer walked with");
  out.push("  ++, an accumulator, a reused temporary. Splitting it into");
  out.push("  single-assignment locals buys the promotion and sinks the insn;");
  out.push("  merging two locals into one does the reverse. That is the lever");
  out.push("  this report exists to name.");
  return out.join("\n");
}

function build(functionName: string, source: string, pass: string): SchedulerTraceReport {
  const outputDir = join("build", "schedulerTrace", functionName);
  const artifacts = compileSource(source, outputDir, functionName, { dumps: true });
  const dumpPath = join(artifacts.outputDir, `${functionName}.i.${pass}`);
  if (!existsSync(dumpPath)) {
    throw new Error(`no ${pass} dump at ${dumpPath} — the pass may be disabled by the configured flags`);
  }
  const dump = readFileSync(dumpPath, "utf8");
  const blocks = parseBlocks(dump);
  const summaries = parseRtlSummaries(dump);

  return {
    functionName,
    source: source.startsWith(ROOT) ? source.slice(ROOT.length + 1) : source,
    pass,
    cc1Flags: artifacts.cc1Flags,
    blocks: blocks.map((block) => {
      /* Bottom-up: the highest cycle is emitted first. */
      const ordered = [...block.choices].sort((a, b) => b.cycle - a.cycle);
      /* The `insn[N]: priority = ...` table is the pre-scheduling critical
       * path. adjust_priority runs later, as each insn becomes ready, so the
       * value that decided the contest is the one printed beside the insn in
       * the ready list — never the table. */
      const observed = new Map<number, number>();
      for (const choice of block.choices) {
        for (const entry of choice.ready) {
          observed.set(entry.uid, Math.max(observed.get(entry.uid) ?? 0, entry.priority));
        }
      }
      const emitted = ordered.map((choice, index) => {
        const priority = observed.get(choice.chosen)
          ?? block.priorities.get(choice.chosen)?.priority
          ?? 0;
        return {
          position: index + 1,
          uid: choice.chosen,
          priority,
          promoted: promoted(priority),
          rtl: summaries.get(choice.chosen) ?? "?",
          reason: reasonFor(choice),
        };
      });
      return {
        index: block.index,
        emitted,
        unpromoted: emitted
          .filter((insn) => !insn.promoted && !insn.rtl.startsWith("store") && insn.rtl !== "jump")
          .map((insn) => insn.uid),
      };
    }),
  };
}

function usage(message?: string): never {
  if (message) console.error(`schedulerTrace: ${message}\n`);
  console.error("Usage: npx tsx tools/agent/schedulerTrace.ts <func> [--src <file>]");
  console.error("       [--pass sched|sched2|both] [--block <n>] [--json]");
  process.exit(1);
}

const isCLI = process.argv[1]?.endsWith("schedulerTrace.ts");
if (isCLI) {
  const args = process.argv.slice(2);
  let functionName: string | undefined;
  let requestedSource: string | undefined;
  let pass = "sched";
  let blockFilter: number | undefined;
  let json = false;

  for (let index = 0; index < args.length; index++) {
    const argument = args[index]!;
    if (argument === "--src") {
      requestedSource = args[++index];
      if (!requestedSource) usage("--src requires a file");
    } else if (argument === "--pass") {
      pass = args[++index] ?? "";
      if (!["sched", "sched2", "both"].includes(pass)) usage("--pass takes sched, sched2 or both");
    } else if (argument === "--block") {
      const raw = args[++index];
      if (!raw || !/^\d+$/.test(raw)) usage("--block requires an integer");
      blockFilter = Number(raw);
    } else if (argument === "--json") {
      json = true;
    } else if (argument.startsWith("--")) {
      usage(`unknown option ${argument}`);
    } else if (functionName) {
      usage("only one function may be traced");
    } else {
      functionName = argument;
    }
  }
  if (!functionName) usage("missing function name");

  const name = normalizeFunctionName(functionName);
  const source = resolveSource(name, requestedSource);
  const passes = pass === "both" ? ["sched", "sched2"] : [pass];
  const reports = passes.map((one) => build(name, source, one));

  if (json) {
    console.log(JSON.stringify(reports.length === 1 ? reports[0] : reports, null, 2));
  } else {
    console.log(reports.map((report) => render(report, blockFilter)).join("\n\n" + "-".repeat(72) + "\n\n"));
    console.log(`\nartifacts: build/schedulerTrace/${name}/${basename(source, ".c")}`.replace(/\/[^/]*$/, ""));
  }
}
