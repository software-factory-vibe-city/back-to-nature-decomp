#!/usr/bin/env npx tsx
/**
 * loopTrace.ts — observe GCC 2.95's loop optimizer.
 *
 * This project can watch every pass that owns a residual except one.
 * `psx_reverse_pipeline` names the pass; `psx_allocator_counterfactual` states
 * the allocation requirement as a number; `psx_search_scheduler_state` returns
 * SAT or UNSAT for a scheduler state. For `loop.c` there was nothing, so a
 * residual owned by loop-invariant hoisting had to be reasoned about from the
 * pass source — and reasoning from source produced a wrong answer twice on
 * `ovl_10_func_800BA394` before anyone compiled with `-dL` and looked.
 *
 * `-dL` is in the vendored cc1 and `loop.c` logs its own decisions. This reads
 * them.
 *
 * What it is NOT: a reading of the target. There is no loop dump for a binary
 * nobody compiled, so unlike the pipeline reversal this cannot compare the two
 * sides. It says what *this* program's loop pass decided; the residual says
 * what the original's must have decided differently, and the two together are
 * what a search steers by. That asymmetry is why the report gives decision
 * variables — `savings 2, life 2, moved` — rather than conclusions.
 *
 * Usage:
 *   npx tsx tools/agent/loopTrace.ts ovl_10_func_800BA394
 *   npx tsx tools/agent/loopTrace.ts ovl_10_func_800BA394 --source /tmp/variant.c
 *   npx tsx tools/agent/loopTrace.ts ovl_10_func_800BA394 --json
 *   npx tsx tools/agent/loopTrace.ts --threshold      # the running record only
 */

import { existsSync, readFileSync, rmSync } from "node:fs";
import { isAbsolute, join } from "node:path";
import {
  ROOT,
  compileSource,
  normalizeFunctionName,
  preprocessOnly,
  resolveSource,
} from "./decompToolchain.js";
import {
  ensureArtifact,
  projectPath,
  renderProvenance,
  sha256,
  stamped,
  toolchainHash,
  writeStableJson,
  type EnsuredArtifact,
  type Provenance,
} from "./provenance.js";
import { parseLoopDump } from "./loop-trace/parse.js";
import { readLineMap, sameCode, type LineMap } from "./loop-trace/lines.js";
import { nameFor, readRtlFacts } from "./loop-trace/symbols.js";
import { addValues, constant, rtlValue, rtlValues } from "./loop-trace/values.js";
import { parseRtlInstructions, parseRtlNotes } from "./compiler-trace/rtl-parser.js";
import { preheaderLayouts } from "./loop-trace/preheader.js";
import { findCascades } from "./loop-trace/cascade.js";
import { hashSource, recordConstraints, readThresholdLedger, LEDGER_PATH } from "./loop-trace/ledger.js";
import {
  harvestConstraints,
  movableMargins,
  solveThreshold,
  type Constraint,
  type RejectedConstraint,
} from "./loop-trace/threshold.js";
import { renderThreshold, renderTrace } from "./loop-trace/render.js";
import type { LoopTrace } from "./loop-trace/types.js";

/** The source compiled nothing under this name; see where it is thrown. */
export class StubSourceError extends Error {}

export interface LoopTraceResult {
  functionName: string;
  source: string;
  cc1Flags: string[];
  dumpPath: string;
  trace: LoopTrace;
  constraints: Constraint[];
  rejected: RejectedConstraint[];
}

/**
 * Attach the symbol each decision is about.
 *
 * `loop.c` logs UIDs and regnos, never names, so a movable reads as
 * `Insn 1225: regno 523` — and which address that is, is the entire question
 * when a residual is one hoist in the wrong place.
 */
function resolveSymbols(trace: LoopTrace, directory: string, stem: string): void {
  const facts = readRtlFacts(directory, stem);
  const stagePath = facts.stage ? join(directory, `${stem}.i.${facts.stage}`) : undefined;
  const beforeDump = stagePath ? readFileSync(stagePath, "utf8") : "";
  const values = rtlValues(beforeDump);
  const notes = parseRtlNotes(beforeDump, "loop-values");
  const calls = parseRtlInstructions(beforeDump, "loop-values").filter((insn) => insn.kind === "call_insn");
  const after = rtlValues(readFileSync(join(directory, `${stem}.i.loop`), "utf8"));
  for (const pass of trace.passes) {
    for (const loop of pass.loops) {
      const start = notes.find((note) => note.uid === loop.from && note.kind === "loop-begin");
      const end = notes.find((note) => note.uid === loop.to && note.kind === "loop-end");
      if (start && end) loop.hasCall = calls.some((insn) => insn.chainOrder !== undefined && insn.chainOrder > start.order && insn.chainOrder < end.order);
      for (const movable of loop.movables) {
        const name = nameFor(facts, movable.insn, movable.regno);
        if (name !== undefined) movable.symbol = name;
        const value = values.byInsn.get(movable.insn) ?? after.byInsn.get(movable.insn)
          ?? (movable.movedTo === undefined ? undefined : after.byInsn.get(movable.movedTo));
        if (value) movable.value = value;
      }
      for (const giv of loop.givs) {
        const name = nameFor(facts, giv.insn, giv.reg);
        if (name !== undefined) giv.symbol = name;
        const biv = loop.bivs.find((entry) => entry.regno === giv.srcReg && entry.verified);
        const mult = rtlValue(giv.mult, values.registers);
        const increment = rtlValue(biv?.increment, values.registers);
        const initial = rtlValue(biv?.initialValue, values.registers);
        const add = rtlValue(giv.add, values.registers);
        if (mult?.base === "constant" && increment?.base === "constant") giv.step = mult.offset * increment.offset;
        if (mult?.base === "constant" && initial?.base === "constant") {
          const value = addValues(constant(mult.offset * initial.offset), add);
          if (value) giv.initial = value;
        }
      }
    }
  }
}

function traceDirectory(functionName: string): string {
  return join(ROOT, "build/loopTrace", functionName);
}

/**
 * Compile with `-dL` and parse the log, reusing a previous run only when every
 * input that decides the answer is unchanged.
 *
 * The dump file is removed first because cc1 opens it with `"a"`: a second
 * compile into the same directory appends a second copy of the log, and a
 * parser reading the concatenation would report twice the passes.
 */
export function loopTrace(
  functionName: string,
  sourceOverride?: string,
  /**
   * A sub-directory to keep this trace in, for a source that is not the
   * function's current one.
   *
   * Without it, tracing several of a function's preserved programs writes each
   * over the last: the artifact is keyed on the function, so every run after
   * the first regenerates, the "reused (inputs unchanged)" line becomes a lie,
   * and the function's own trace is gone. A variant gets its own slot instead,
   * so the current source's trace stays where every other reader expects it.
   */
  variant?: string,
): { result: LoopTraceResult; ensured: EnsuredArtifact<LoopTraceResult> } {
  const source = resolveSource(functionName, sourceOverride);
  const directory = variant === undefined
    ? traceDirectory(functionName)
    : join(traceDirectory(functionName), "variants", variant);
  const artifactPath = join(directory, "trace.json");
  /* Hoist decisions depend on header layouts/macros too, not just source bytes.
     Hash fresh cpp and compile that very snapshot rather than a second context. */
  const preprocessed = readFileSync(preprocessOnly(source, directory, "trace-context"), "utf8");

  const ensured = ensureArtifact<LoopTraceResult>({
    artifactPath,
    label: `loop pass trace of ${projectPath(source)}`,
    functionName,
    costHint: "one cc1 compile",
    inputs: {
      files: [source, join(ROOT, "configs/flag_overrides.mk")],
      values: { dump: "-dL", contextHash: sha256(preprocessed) },
      implementation: [
        join(ROOT, "tools/agent/decompToolchain.ts"),
        join(ROOT, "tools/agent/loopTrace.ts"),
        join(ROOT, "tools/agent/loop-trace"),
      ],
    },
    produce: (provenance) => {
      const dumpPath = join(directory, `${functionName}.i.loop`);
      rmSync(dumpPath, { force: true });
      /* `-da` rather than `-dL`: the same single compile, and it also leaves the
         dump from the pass before loop, which is the only place the moved
         insns' UIDs can still be resolved to the symbols they materialise. */
      const artifacts = compileSource(source, directory, functionName, { dumps: true, preprocessedText: preprocessed });
      if (!existsSync(dumpPath)) {
        throw new Error(
          `cc1 wrote no loop dump for ${functionName}. Expected ${projectPath(dumpPath)} — ` +
          "the source may define no function under this name, or may not compile.",
        );
      }
      const trace = parseLoopDump(readFileSync(dumpPath, "utf8"), functionName);
      resolveSymbols(trace, directory, functionName);
      if (trace.functionName === "") {
        /* cc1 wrote a dump but no section for this symbol, so the source
           compiled no function under this name — an INCLUDE_ASM stub is the
           usual reason. Recording an empty constraint set for it would *erase*
           the function's real evidence from the running threshold record,
           because a re-trace replaces a function's constraints by design. */
        throw new StubSourceError(
          `${projectPath(source)} defines no function named ${functionName} that cc1 compiled — ` +
          "it is an assembly stub, or the symbol is spelled differently. Pass --source with the " +
          "candidate C you want traced.",
        );
      }
      const harvest = harvestConstraints(trace, { functionName, cc1Flags: artifacts.cc1Flags });
      const value: LoopTraceResult = {
        functionName,
        source: projectPath(source),
        cc1Flags: artifacts.cc1Flags,
        dumpPath: projectPath(dumpPath),
        trace,
        constraints: harvest.constraints,
        rejected: harvest.rejected,
      };
      writeStableJson(artifactPath, stamped(value, provenance));
      return value;
    },
    read: (stored) => {
      const value = stored as LoopTraceResult;
      if (!value?.trace?.passes) throw new Error("stored loop trace has no passes");
      return value;
    },
  });

  return { result: ensured.value, ensured };
}

/**
 * Insn UID -> source line for one compiled source, or nothing.
 *
 * Two compiles: the ordinary one, and one with `-g`, whose only purpose is the
 * line notes `no_line_numbers` otherwise suppresses. `emit_note` consumes the
 * UID either way, so the numbering is shared — and this checks that claim
 * against the two instruction streams rather than trusting it. A mismatch
 * returns nothing: a wrong line sends a reader to code the decision was never
 * about, which is worse than sending them to the whole function.
 */
export function lineMapFor(functionName: string, sourceOverride?: string): LineMap | undefined {
  const source = resolveSource(functionName, sourceOverride);
  const directory = join(traceDirectory(functionName), "lines");
  const artifactPath = join(directory, "lines.json");
  const preprocessed = readFileSync(preprocessOnly(source, directory, "lines-context"), "utf8");

  const ensured = ensureArtifact<{ file: string; byInsn: Array<[number, number]> } | null>({
    artifactPath,
    label: `source-line attribution for ${projectPath(source)}`,
    functionName,
    costHint: "two cc1 compiles",
    inputs: {
      files: [source, join(ROOT, "configs/flag_overrides.mk")],
      values: { debug: "-g", contextHash: sha256(preprocessed) },
      implementation: [
        join(ROOT, "tools/agent/decompToolchain.ts"),
        join(ROOT, "tools/agent/loopTrace.ts"),
        join(ROOT, "tools/agent/loop-trace"),
      ],
    },
    produce: (provenance) => {
      let value: { file: string; byInsn: Array<[number, number]> } | null = null;
      try {
        const plain = compileSource(source, join(directory, "plain"), functionName, { preprocessedText: preprocessed });
        const debug = compileSource(source, join(directory, "debug"), functionName,
          { dumps: true, extraCc1Flags: ["-g"], preprocessedText: preprocessed });
        if (sameCode(readFileSync(plain.assembly, "utf8"), readFileSync(debug.assembly, "utf8"))) {
          const map = readLineMap(join(directory, "debug"), functionName);
          if (map) value = { file: map.file, byInsn: [...map.byInsn] };
        }
      } catch {
        /* No attribution is a missing convenience, never a failed reading. */
      }
      writeStableJson(artifactPath, stamped({ value }, provenance));
      return value;
    },
    read: (stored) => (stored as { value: { file: string; byInsn: Array<[number, number]> } | null }).value,
  });

  const value = ensured.value;
  return value === null ? undefined : { file: value.file, byInsn: new Map(value.byInsn) };
}

/**
 * A trace already on disk for a source whose text has not changed since.
 *
 * For readers that want a *measured* fact about another function and must not
 * spend a compile to get one — a precedent citation, a corpus scan. It is a
 * cache read, so it carries the risk the whole provenance module exists to
 * prevent; the freshness check is therefore not skipped but narrowed: the
 * stored stamp records the hash of every file the trace was derived from, and
 * this re-hashes the named source and refuses on any difference. A stale trace
 * is reported as absent, never as evidence.
 */
export function cachedLoopTrace(functionName: string): { trace: LoopTrace; source: string } | undefined {
  const artifactPath = join(traceDirectory(functionName), "trace.json");
  if (!existsSync(artifactPath)) return undefined;
  try {
    const stored = JSON.parse(readFileSync(artifactPath, "utf8")) as LoopTraceResult & { provenance?: Provenance };
    if (!stored?.trace?.passes || typeof stored.source !== "string") return undefined;
    const recorded = stored.provenance?.files?.[stored.source];
    if (typeof recorded !== "string") return undefined;
    const absolute = isAbsolute(stored.source) ? stored.source : join(ROOT, stored.source);
    if (!existsSync(absolute) || sha256(readFileSync(absolute, "utf8")) !== recorded) return undefined;
    return { trace: stored.trace, source: stored.source };
  } catch {
    return undefined;
  }
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const json = argv.includes("--json");
  const thresholdOnly = argv.includes("--threshold");
  const sourceFlag = argv.indexOf("--source");
  const sourceOverride = sourceFlag >= 0 ? argv[sourceFlag + 1] : undefined;
  const positional = argv.filter((argument, index) =>
    !argument.startsWith("--") && !(sourceFlag >= 0 && index === sourceFlag + 1));

  if (thresholdOnly && positional.length === 0) {
    const ledger = readThresholdLedger(toolchainHash());
    const names = Object.keys(ledger.functions).sort();
    const all = names.flatMap((name) => ledger.functions[name]!.constraints);
    const solution = solveThreshold(all);
    if (json) {
      console.log(JSON.stringify({ functions: names, solution }, null, 2));
      return;
    }
    console.log(renderThreshold(solution, { ledgerFunctions: names, ledgerPath: projectPath(LEDGER_PATH) }).join("\n"));
    return;
  }

  if (positional.length !== 1 || (sourceFlag >= 0 && !sourceOverride)) {
    console.error("Usage: npx tsx tools/agent/loopTrace.ts <func_name> [--source <path.c>] [--json]");
    console.error("       npx tsx tools/agent/loopTrace.ts --threshold [--json]");
    process.exit(1);
  }

  const functionName = normalizeFunctionName(positional[0]!);
  let traced: ReturnType<typeof loopTrace>;
  try {
    traced = loopTrace(functionName, sourceOverride);
  } catch (error) {
    console.error(`loopTrace: ${(error as Error).message}`);
    process.exit(1);
    return;
  }
  const { result, ensured } = traced;

  const recorded = recordConstraints({
    functionName,
    /* `projectPath` leaves an out-of-tree source absolute, so it must not be
       re-joined against ROOT. */
    sourceHash: hashSource(readFileSync(isAbsolute(result.source) ? result.source : join(ROOT, result.source), "utf8")),
    constraints: result.constraints,
    toolchainHash: toolchainHash(),
  });
  const solution = solveThreshold(recorded.all);
  const margins = solution.candidates.length === 1
    ? movableMargins(result.trace, solution.candidates[0]!, solution.brackets)
    : [];

  let desirability: import("./loop-emission/desirability.js").HoistAssessment[] = [];
  try {
    const { scoreTargetLoopEmission } = await import("./analyzeTargetLoopEmission.js");
    desirability = scoreTargetLoopEmission(functionName, sourceOverride).assessments;
  } catch { /* Target-side evidence is optional for a candidate-only trace. */ }

  if (json) {
    console.log(JSON.stringify({
      function: functionName,
      desirability,
      source: result.source,
      dump: result.dumpPath,
      passes: result.trace.passes,
      unrecognised: result.trace.unrecognised,
      preheaders: preheaderLayouts(result.trace),
      cascades: findCascades(result.trace),
      constraints: result.constraints,
      rejected: result.rejected,
      threshold: { solution, margins, functions: recorded.functions },
    }, null, 2));
    return;
  }

  console.log(renderTrace(result.trace, solution, {
    source: result.source,
    ledgerFunctions: recorded.functions,
    ledgerPath: projectPath(LEDGER_PATH),
    rejected: result.rejected,
  }));

  if (margins.length > 0) {
    console.log("");
    console.log("WHAT EACH DECISION HINGED ON (threshold known, so this is arithmetic)");
    console.log("  move_movables compares savings x lifetime against ceil(insn_count / threshold),");
    console.log("  where the threshold has already lost 3 for every movable moved before it.");
    console.log("  `savings` starts at n_times_set[regno] and ABSORBS the savings of every movable");
    console.log("  that matches or forces it; `lifetime` absorbs theirs the same way. A second");
    console.log("  materialisation of the same value inside the loop therefore feeds the hoist.");
    for (const margin of margins) {
      const verdict = margin.actualProduct >= margin.requiredProduct ? "moves" : "stays";
      const carried = margin.carriedBy ? `, but moved anyway via ${margin.carriedBy}` : "";
      console.log(
        `    pass ${margin.pass} loop ${margin.loop} insn ${margin.insn}: ` +
        `threshold ${margin.effectiveThreshold} (initial minus 3x${margin.decay}), ` +
        `needs product >= ${margin.requiredProduct}, has ${margin.actualProduct} -> ${verdict}${carried}`);
    }
  }

  const { renderDesirability } = await import("./loop-emission/desirability.js");
  console.log(renderDesirability(desirability).join("\n"));
  console.log("");
  console.log(renderProvenance([{ label: "loop pass trace", ensured }]));
}

if (import.meta.url === `file://${process.argv[1]}`) main();
