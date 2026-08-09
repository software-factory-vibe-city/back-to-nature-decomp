/**
 * Registration for every `tools/agent` CLI that is not already its own tool
 * file. One Pi tool per CLI — a tool's subcommands stay parameters of that
 * tool, they do not become separate tools.
 *
 * These were previously reachable only as `npx tsx` lines inside the skill,
 * which made them invisible to anything that reads the tool list. The table is
 * the registration, so adding a CLI is one entry rather than one file.
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type, type TObject } from "typebox";
import { runProjectCommand, validateFunctionName } from "./shared.ts";

const FUNCTION = (description: string) => Type.String({ description });
const JSON_FLAG = Type.Optional(Type.Boolean({ description: "Return the machine-readable JSON report" }));

interface ToolSpec {
  name: string;
  label: string;
  script: string;
  description: string;
  parameters: TObject;
  /** Build the CLI argv from validated params. */
  argv: (params: Record<string, unknown>) => string[];
  timeout: number;
}

/** Shape shared by most diagnostics: one function name, optional --json. */
function functionTool(
  name: string,
  label: string,
  script: string,
  description: string,
  options: { functionDescription?: string; timeout?: number; extra?: Record<string, unknown>; argv?: (params: Record<string, unknown>) => string[] } = {},
): ToolSpec {
  return {
    name,
    label,
    script,
    description,
    parameters: Type.Object({
      functionName: FUNCTION(options.functionDescription ?? "Exact function symbol to analyze"),
      json: JSON_FLAG,
      ...(options.extra ?? {}),
    }),
    argv: options.argv ?? ((params) => [
      params.functionName as string,
      ...(params.json ? ["--json"] : []),
    ]),
    timeout: options.timeout ?? 120_000,
  };
}

export const TOOL_SPECS: ToolSpec[] = [
  /* ---- pre-flight: run before authoring source ---- */
  functionTool(
    "psx_triage", "PSX Triage", "triage.ts",
    "Pre-flight symptom detectors for one function: frame map, PSY-Q SDK idioms, target-versus-source inventory, arity, debug-hook and source-policy classes. Works on a bare INCLUDE_ASM stub. Run before writing the first line of source and again after every structural edit; a `blocker` finding means the current direction cannot ship regardless of diff score.",
    { extra: { src: Type.Optional(Type.String({ description: "Alternate source file to compile instead of src/<function>.c" })) },
      argv: (p) => [p.functionName as string, ...(p.src ? ["--src", p.src as string] : []), ...(p.json ? ["--json"] : [])] },
  ),
  functionTool(
    "psx_frame_map", "PSX Frame Map", "frameMap.ts",
    "Exact frame decomposition (outgoing argument area, locals, saved registers) and the signature the ABI implies. Stack parameter types are read off load width and signedness and are exact — take them rather than re-deriving them. Never report a frame size that did not come from here.",
  ),
  functionTool(
    "psx_sdk_idioms", "PSX SDK Idioms", "sdkIdioms.ts",
    "Identify the PSY-Q primitive type and macro expansions present in the target, with the field map naming every offset the function touches. Hand-rolled bitfield arithmetic where the SDK has a macro is a reconstruction error, not a style choice.",
  ),
  functionTool(
    "psx_inventory", "PSX Inventory", "inventory.ts",
    "Order-independent content diff against the target: memory offsets, constants and shift amounts as multisets. Invariant to scheduling and allocation, so anything marked TARGET ONLY is a semantic defect. An empty inventory is a precondition for allocation or ordering work, not a nicety.",
    { extra: { src: Type.Optional(Type.String({ description: "Alternate source file to compile instead of src/<function>.c" })) },
      argv: (p) => [p.functionName as string, ...(p.src ? ["--src", p.src as string] : []), ...(p.json ? ["--json"] : [])] },
  ),
  functionTool(
    "psx_scan_read_before_def", "PSX Read-Before-Def Scan", "scanReadBeforeDef.ts",
    "Scan the target assembly for locals read before definition. A finding places the function in the register-variable / handwritten fingerprint class (policy-exception territory); a clean scan rules that class out before you hypothesize it.",
    { functionDescription: "Function symbol, or a path to a .s file" },
  ),
  functionTool(
    "psx_flag_probe", "PSX Flag Probe", "flagProbe.ts",
    "Early per-file flag-hypothesis check, from three independent sources: structural fingerprints decoded from the original binary's bytes (no source needed), a flag-matrix score of the current source, and nearby overrides (flags are per-TU). Run BEFORE deep source archaeology. A matrix showing baseline equal to the delta kills a flag hypothesis cheaply.",
  ),

  /* ---- evidence for a specific mismatch class ---- */
  functionTool(
    "psx_mine_statement_order", "PSX Statement Order", "mineStatementOrder.ts",
    "Per-block emission-order evidence (hi16 formation order, store order, delay-slot occupant) that constrains source statement order directly. Use for questions like which global is touched first or where a pointer assignment sits in a branch.",
  ),
  functionTool(
    "psx_analyze_store_block", "PSX Store Block", "analyzeStoreBlock.ts",
    "Mine a block of constant/pointer stores for arithmetic structure (parallel arrays, pool-carving running sums, repeated constants) and check the constant birth-order fingerprint. Run BEFORE scheduler analysis on an order-only store block; never derive statement order from the emitted store order.",
    { extra: {
        target: Type.Optional(Type.String({ description: "Target .s file override" })),
        candidate: Type.Optional(Type.String({ description: "Candidate .s file override" })),
      },
      argv: (p) => [p.functionName as string,
        ...(p.target ? ["--target", p.target as string] : []),
        ...(p.candidate ? ["--candidate", p.candidate as string] : []),
        ...(p.json ? ["--json"] : [])] },
  ),

  /* ---- the compiler itself ---- */
  {
    name: "psx_compiler_source",
    label: "PSX Compiler Source",
    script: "compilerSource.ts",
    description:
      "Search the source of the compiler that builds this project (tools/vendor/gcc/<GCC_VERSION>, the exact patched tree cc1 is built from). Commands: `pass` maps a dump suffix (.gcse, .lreg, .greg, .sched2) to the passes whose output it shows and the flag that gates them; `def` and `body` locate and print a function, macro, variable or typedef; `refs` lists identifier references with comments and strings excluded; `pattern` prints a machine-description pattern such as movsi_internal2; `grep` is a scoped regex; `health` reports index coverage; `verify` checks the tree against its hash pin. Prefer one read of the pass that decides a thing over another round of source shapes — a proof that a form is unreachable ends a search, a failed experiment does not.",
    parameters: Type.Object({
      command: Type.Union([
        Type.Literal("def"), Type.Literal("body"), Type.Literal("refs"), Type.Literal("pass"),
        Type.Literal("pattern"), Type.Literal("grep"), Type.Literal("health"), Type.Literal("verify"),
      ], { description: "Which query to run" }),
      subject: Type.Optional(Type.String({ description: "Name, dump suffix, or regex the command operates on; omit for health and verify" })),
      file: Type.Optional(Type.String({ description: "Restrict to files whose path contains this substring, e.g. reload1.c" })),
      version: Type.Optional(Type.String({ description: "Vendored GCC version to read; defaults to the Makefile's GCC_VERSION" })),
      limit: Type.Optional(Type.Number({ description: "Maximum rows for refs and grep (default 40)" })),
      json: JSON_FLAG,
    }),
    argv: (p) => [
      p.command as string,
      ...(p.subject ? [p.subject as string] : []),
      ...(p.file ? ["--file", p.file as string] : []),
      ...(p.version ? ["--version", p.version as string] : []),
      ...(p.limit ? ["--limit", String(p.limit)] : []),
      ...(p.json ? ["--json"] : []),
    ],
    timeout: 120_000,
  },

  /* ---- allocator and scheduler state ---- */
  functionTool(
    "psx_allocator_counterfactual", "PSX Allocator Counterfactual", "analyzeAllocatorCounterfactual.ts",
    "Bounded counterfactual over global allocation: which conflicting pseudo won a hard register, and what would have had to differ for the other to win. Use when an allocation fight survives source-order swaps and web parity already passes.",
    { timeout: 600_000 },
  ),
  functionTool(
    "psx_local_allocation_oracle", "PSX Local Allocation Oracle", "analyzeLocalAllocationOracle.ts",
    "Read an instrumented-compiler run and report local-alloc's observed quantity priorities and assignment order against the model.",
    { extra: { report: Type.Optional(Type.String({ description: "Path to a compilerOracle report.json" })) },
      argv: (p) => [p.functionName as string, ...(p.report ? ["--report", p.report as string] : [])],
      timeout: 600_000 },
  ),
  functionTool(
    "psx_solve_local_allocation", "PSX Solve Local Allocation", "solveLocalAllocationState.ts",
    "Solve for the local-alloc state (quantity priorities and phantom references) that reproduces the target's register assignment. Treat a solution as a specification for a small complete-source experiment; never promote a solver witness directly.",
    { extra: {
        maxPhantoms: Type.Optional(Type.Number({ description: "Phantom reference bound (default 3)" })),
        maxSolutions: Type.Optional(Type.Number({ description: "Solution cap (default 16)" })),
      },
      argv: (p) => [p.functionName as string,
        ...(p.maxPhantoms !== undefined ? ["--max-phantoms", String(p.maxPhantoms)] : []),
        ...(p.maxSolutions !== undefined ? ["--max-solutions", String(p.maxSolutions)] : [])],
      timeout: 600_000 },
  ),
  functionTool(
    "psx_minimize_local_allocation", "PSX Minimize Local Allocation", "minimizeLocalAllocation.ts",
    "Narrow a broad successful allocation probe to the smallest source region that still preserves the intended compiler effect.",
    { extra: { forceBuild: Type.Optional(Type.Boolean({ description: "Rebuild the instrumented compiler first" })) },
      argv: (p) => [p.functionName as string, ...(p.forceBuild ? ["--force-build"] : [])],
      timeout: 900_000 },
  ),
  functionTool(
    "psx_inspect_local_allocation_variant", "PSX Inspect Allocation Variant", "inspectLocalAllocationVariant.ts",
    "Report local-alloc state for one candidate source file, so a variant's allocation can be compared against the baseline without a full search.",
    { extra: {
        source: Type.String({ description: "Candidate .c file to compile and inspect" }),
        block: Type.Optional(Type.Number({ description: "Restrict to one basic block" })),
      },
      argv: (p) => [p.functionName as string, p.source as string,
        ...(p.block !== undefined ? ["--block", String(p.block)] : [])],
      timeout: 600_000 },
  ),
  functionTool(
    "psx_instrument_compiler_oracle", "PSX Instrument Compiler Oracle", "instrumentCompilerOracle.ts",
    "Build and run the instrumented cc1 that logs local-alloc and scheduler decisions. Use --prepare/--build to stage the image without analyzing a function.",
    { extra: { forceBuild: Type.Optional(Type.Boolean({ description: "Rebuild the instrumented compiler image" })) },
      argv: (p) => [p.functionName as string, ...(p.forceBuild ? ["--force-build"] : [])],
      timeout: 1_800_000 },
  ),
  functionTool(
    "psx_search_scheduler_state", "PSX Search Scheduler State", "searchSchedulerState.ts",
    "SAT search for the scheduler state (webs, boosts, LUIDs, phantoms) that reproduces the target order in one block. Require the candidate replay gate to be exact; treat scoped UNSAT as a reason to stop only that serialized domain, and INCONCLUSIVE or a model-replay failure as no proof.",
    { extra: {
        stage: Type.Optional(Type.Union([Type.Literal("sched"), Type.Literal("sched2")], { description: "Scheduler pass to model" })),
        block: Type.Optional(Type.Number({ description: "Basic block index" })),
        maxPhantoms: Type.Optional(Type.Number({ description: "Phantom bound, 0..3" })),
        maxAssignments: Type.Optional(Type.Number({ description: "Assignment bound" })),
      },
      argv: (p) => [p.functionName as string,
        ...(p.stage ? ["--stage", p.stage as string] : []),
        ...(p.block !== undefined ? ["--block", String(p.block)] : []),
        ...(p.maxPhantoms !== undefined ? ["--max-phantoms", String(p.maxPhantoms)] : []),
        ...(p.maxAssignments !== undefined ? ["--max-assignments", String(p.maxAssignments)] : []),
        ...(p.json ? ["--json"] : [])],
      timeout: 1_800_000 },
  ),

  /* ---- exhaustive source-space search ---- */
  functionTool(
    "psx_search_residual_source_space", "PSX Residual Source Search", "searchResidualSourceSpace.ts",
    "Exhaustive search of the semantics-preserving source representations reachable from the current source, seeded from the real machine residual. There are no tuning knobs: use deriveOnly first to price the run — it reports exact domain size, the per-axis radix breakdown, and a projected wall time. A `domain-too-large` result names the axis responsible; the only lever on it is a smaller residual.",
    { extra: {
        deriveOnly: Type.Optional(Type.Boolean({ description: "Price the domain without evaluating it" })),
        source: Type.Optional(Type.String({ description: "Alternate source file to search from" })),
      },
      argv: (p) => [p.functionName as string,
        ...(p.deriveOnly ? ["--derive-only"] : []),
        ...(p.source ? ["--source", p.source as string] : []),
        ...(p.json ? ["--json"] : [])],
      timeout: 3_600_000 },
  ),

  /* ---- policy and prompts ---- */
  {
    name: "psx_source_policy",
    label: "PSX Source Policy",
    script: "sourcePolicy.ts",
    description:
      "Run the clean-source policy gate: scan for register pinning, embedded or top-level assembly, new assembly stubs, flag overrides, and copied legacy workarounds that are not allowlisted in .pi/autodecomp.json. Omit the function name to scan every live compiled function.",
    parameters: Type.Object({
      functionName: Type.Optional(Type.String({ description: "Restrict the scan to one function; omit to scan all" })),
      json: JSON_FLAG,
    }),
    argv: (p) => [
      ...(p.functionName ? ["--function", p.functionName as string] : []),
      ...(p.json ? ["--json"] : []),
    ],
    timeout: 300_000,
  },
  {
    name: "psx_c_source_guard",
    label: "PSX C Source Guard",
    script: "cSourceGuard.ts",
    description:
      "AST answers about a C translation unit, read from the tree-sitter parse rather than matched by pattern: does it parse, is it safe to place inside a disabled `#if 0` block (no dangling #endif/#else, no unterminated conditional, no literal running past its line), and which INCLUDE_ASM placeholders does it declare and for which symbols. Use it before any tool moves, wraps, or rewrites C source.",
    parameters: Type.Object({
      paths: Type.Array(Type.String({ description: "Project-relative path to a .c or .h file" }), {
        description: "One or more source files to inspect",
        minItems: 1,
      }),
    }),
    argv: (p) => p.paths as string[],
    timeout: 120_000,
  },
  functionTool(
    "psx_get_prompt", "PSX Get Prompt", "getPrompt.ts",
    "Print the assembled decompilation prompt and context for one function.",
  ),
];

export function registerDiagnosticTools(pi: ExtensionAPI): void {
  for (const spec of TOOL_SPECS) {
    pi.registerTool({
      name: spec.name,
      label: spec.label,
      description: `${spec.description} Output is limited to 50 KB or 2000 lines.`,
      parameters: spec.parameters,
      async execute(_toolCallId, params, signal, onUpdate, ctx) {
        const record = params as Record<string, unknown>;
        if (typeof record.functionName === "string") validateFunctionName(record.functionName);
        onUpdate?.({ content: [{ type: "text", text: `${spec.label}: running ${spec.script}...` }], details: {} });
        return runProjectCommand(
          pi,
          ctx.cwd,
          "npx",
          ["tsx", `tools/agent/${spec.script}`, ...spec.argv(record)],
          signal,
          spec.timeout,
        );
      },
    });
  }
}
