/**
 * Registration for every `tools/agent` CLI that is not already its own tool
 * file. One Pi tool per CLI — a tool's subcommands stay parameters of that
 * tool, they do not become separate tools.
 *
 * These were previously reachable only as `npx tsx` lines inside the skill,
 * which made them invisible to anything that reads the tool list. The table is
 * the registration, so adding a CLI is one entry rather than one file.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
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

/**
 * CLIs deliberately not offered to the model, and why.
 *
 * The default is that every CLI is a tool: a diagnostic nobody can call is a
 * diagnostic nobody uses. An entry here is a claim that exposing the CLI makes
 * the workflow worse, and it has to say how — the registration test requires a
 * reason, so an exclusion cannot be a silent omission.
 */
export const UNEXPOSED_CLIS: Record<string, string> = {
  getPrompt:
    "A legacy prompt builder for the archived templates under prompts/legacy/, which " +
    "no active workflow dispatches — the Pi commands and the autonomous workers run " +
    ".pi/skills/ directly. Exposing it did two kinds of harm. It inlines the whole C " +
    "style guide into its output, so one call spends tens of thousands of tokens on " +
    "context the caller already has, against a template nothing else uses. And it is " +
    "stateful in the way this repository is removing: it needs build/callGraph.json " +
    "and tells the caller to run callGraph.ts first. The CLI stays for manual and " +
    "historical reproduction; it is not something an agent should be able to reach for.",
  migrateLedger:
    "A one-off schema migration over build/experimentLedger/, not a diagnostic. It " +
    "reclassifies pre-schema-2 rows on evidence and retires the ones that measured an " +
    "INCLUDE_ASM stub against itself. It rewrites the ledgers in place, which is a " +
    "maintenance action a human should run and read, not something an agent should be " +
    "able to reach for mid-search — a rewritten ledger changes every later reading of " +
    "what has already been tried. New rows are written correctly at the source, so the " +
    "migration is needed once per tree.",
  diffFunc:
    "Two better tools split its job. `psx_residual_objective` gives the same MATCH " +
    "verdict from the same oracle at the same cost, plus a residual that is a distance " +
    "— diffFunc's score is not one, and the style guide had to teach reading around it. " +
    "`psx_finalize_function` is the terminal gate and is strictly stronger: the exact " +
    "diff plus the linked build, the scope check and the clean-source check. Leaving " +
    "diffFunc exposed invites treating a pre-link byte comparison as done, and invites " +
    "hill-climbing a number that rewards a lucky register assignment over a fixed cause. " +
    "The CLI stays: the build, the gates and the autonomous loop all still shell out to it.",
};

export const TOOL_SPECS: ToolSpec[] = [
  /* ---- pre-flight: run before authoring source ---- */
  functionTool(
    "psx_triage", "PSX Triage", "triage.ts",
    "Pre-flight symptom detectors for one function: frame map, PSY-Q SDK idioms, target-versus-source inventory, arity, debug-hook and source-policy classes. Works on a bare INCLUDE_ASM stub. Run before writing the first line of source and again after every structural edit; a `blocker` finding means the current direction cannot ship regardless of diff score.",
    { extra: { src: Type.Optional(Type.String({ description: "Alternate source file to compile instead of the function's own source file" })) },
      argv: (p) => [p.functionName as string, ...(p.src ? ["--src", p.src as string] : []), ...(p.json ? ["--json"] : [])] },
  ),
  functionTool(
    "psx_callee_truth", "PSX Callee Truth", "calleeTruth.ts",
    "Confront every callee declaration in scope with evidence that does not depend on this source: the vendored SDK headers, the callees' own matched definitions, and the callees' own compiled code. Every other tool in this project takes the prototypes as the fixed background and varies the source against them, so a wrong prototype is invisible to all of them at once — it is not a point in the space they search, it is the space, and each rewrite that fails to remove what it manufactured reads as evidence that the residual is hard. Run it before authoring, and again the moment a residual survives rewrites that should have moved it. `include/functions.h` is deliberately not a witness: it is generated from src/, so a wrong signature comes back out of it wearing the authority of a project header.",
    { extra: { src: Type.Optional(Type.String({ description: "Alternate source file to audit instead of the function's own source file" })) },
      argv: (p) => [p.functionName as string, ...(p.src ? ["--src", p.src as string] : []), ...(p.json ? ["--json"] : [])] },
  ),
  functionTool(
    "psx_frame_map", "PSX Frame Map", "frameMap.ts",
    "Exact frame decomposition (outgoing argument area, locals, saved registers) and the signature the ABI implies. Stack parameter types are read off load width and signedness and are exact — take them rather than re-deriving them. Never report a frame size that did not come from here.",
  ),
  functionTool(
    "psx_sdk_idioms", "PSX SDK Idioms", "sdkIdioms.ts",
    "Identify every PSY-Q packet the target builds and the macro operations that build it: primitive initializers including a base code composed with documented attribute bits, command packets with the arguments the observed command word establishes, and complete tag-link operations. Objects are grouped by traced base-register web, so one function can carry several. The field map names every offset the function touches. Hand-rolled bitfield arithmetic where the SDK has a macro is a reconstruction error, not a style choice; restore the operation boundary before any allocation or scheduling reading.",
  ),
  functionTool(
    "psx_inventory", "PSX Inventory", "inventory.ts",
    "Order-independent content diff against the target: memory offsets, constants and shift amounts as multisets. Invariant to scheduling and allocation, so anything marked TARGET ONLY is a semantic defect. An empty inventory is a precondition for allocation or ordering work, not a nicety.",
    { extra: { src: Type.Optional(Type.String({ description: "Alternate source file to compile instead of the function's own source file" })) },
      argv: (p) => [p.functionName as string, ...(p.src ? ["--src", p.src as string] : []), ...(p.json ? ["--json"] : [])] },
  ),
  functionTool(
    "psx_scan_read_before_def", "PSX Read-Before-Def Scan", "scanReadBeforeDef.ts",
    "Scan the target assembly for locals read before definition. A finding places the function in the register-variable / handwritten fingerprint class (policy-exception territory); a clean scan rules that class out before you hypothesize it.",
    { functionDescription: "Function symbol, or a path to a .s file" },
  ),
  functionTool(
    "psx_flag_probe", "PSX Flag Probe", "flagProbe.ts",
    "Early per-file flag-hypothesis check, from three independent sources: structural fingerprints decoded from the original binary's bytes (no source needed), a flag-matrix score of the current source, and nearby overrides (flags are per-TU). Run BEFORE deep source archaeology. A matrix showing baseline equal to the delta kills a flag hypothesis cheaply. Writes build/flagProbe/<function>/report.json with a conclusion scoped to the measured source; triage reads it under a function/source/target/toolchain hash check and stops directing you at a flag its own matrix already tied, without erasing the target fingerprint.",
  ),

  /* ---- evidence for a specific mismatch class ---- */
  functionTool(
    "psx_scheduler_trace", "PSX Scheduler Trace", "schedulerTrace.ts",
    "The scheduler's own per-cycle record of why a block came out in this order: every insn's priority at the moment it competed, the ready list it was chosen from, and whether it won on priority, on a function-unit hazard, or on a tie. Run as soon as a residual is classified as scheduling, BEFORE authoring source variants — spellings that compile to the same RTL are the same experiment, and this says which lever actually moved. The unpromoted list is the actionable output: a non-store insn is unpromoted when its destination pseudo is assigned more than once, which in C is a variable written twice.",
    { extra: {
        src: Type.Optional(Type.String({ description: "Alternate source file to compile instead of the function's own source file" })),
        pass: Type.Optional(Type.String({ enum: ["sched", "sched2", "both"], description: "Scheduling pass: sched (pre-reload, default), sched2 (post-reload), or both" })),
        block: Type.Optional(Type.Integer({ minimum: 0, description: "Restrict output to one basic block" })),
      },
      argv: (p) => [p.functionName as string,
        ...(p.src ? ["--src", p.src as string] : []),
        ...(p.pass ? ["--pass", p.pass as string] : []),
        ...(p.block !== undefined ? ["--block", String(p.block)] : []),
        ...(p.json ? ["--json"] : [])] },
  ),
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

  /* ---- deterministic pipeline reversal ---- */
  functionTool(
    "psx_reverse_pipeline", "PSX Pipeline Reversal", "reversePipeline.ts",
    "Run the deterministic backward chain over the original bytes and the candidate object, and report which compiler pass owns the residual. Output is a waypoint ladder (machine, dbr, mach, greg, lreg), the round-trip checks that license it, and a short list of independent decisions with the source lever for each. Read it before any allocator or scheduler forensics: it separates 'the source computes the wrong thing' from 'the same program, allocated differently', and it recognizes a coalesced copy as an allocation decision rather than a count delta. `backtest` perturbs the named sources in known ways and checks the chain names the right pass.",
    { extra: {
        source: Type.Optional(Type.String({ description: "Alternate source; it is compiled and used as the candidate" })),
        object: Type.Optional(Type.String({ description: "Candidate object to read instead of the built one" })),
        noReplay: Type.Optional(Type.Boolean({ description: "Skip the round-trip check against the -da dumps" })),
        backtest: Type.Optional(Type.Boolean({ description: "Perturb the source in known ways and check the reported stage" })),
      },
      argv: (p) => [p.functionName as string,
        ...(p.source ? ["--source", p.source as string] : []),
        ...(p.object ? ["--object", p.object as string] : []),
        ...(p.noReplay ? ["--no-replay"] : []),
        ...(p.backtest ? ["--backtest"] : []),
        ...(p.json ? ["--json"] : [])],
      timeout: 600_000 },
  ),

  functionTool(
    "psx_target_loop_emission", "PSX Target Loop Emission", "analyzeTargetLoopEmission.ts",
    "What the ORIGINAL's loop optimizer must have done, derived from the target's bytes alone — so it works on a bare INCLUDE_ASM stub, before the first line of source. This is the requirement half that `psx_loop_trace` observes against; every other pass has both (psx_analyze_target_schedule, psx_allocator_counterfactual) and loop.c had only the observer, which is why a preheader residual had nothing to steer by. loop.c emits into a preheader through emit_insn_before(loop_start), so the preheader reads front to back as a NON-DECREASING sequence of emission classes: source < pass-1 movable < pass-1 giv init < pass-2 movable < pass-2 giv init. Each group admits the classes its own evidence allows — an address the loop only reads can be a movable, a register the loop steps by a constant can be an induction init, a call argument neither — and the ordering constraint cuts that down to the requirement. Pass `source` to score a candidate: it reports, per constrained address, MET / NOT MET / UNDETERMINED and a distance to minimise. Minimise THAT, not the byte score — on a preheader residual the byte score is flat across the whole family of source spellings and ranks the mechanism-correct variant worst, which is how a correct variant gets recorded as closed.",
    { extra: { source: Type.Optional(Type.String({ description: "Candidate C to score against the requirement; omit for the requirement alone" })) },
      argv: (p) => [p.functionName as string,
        ...(p.source ? ["--source", p.source as string] : []),
        ...(p.json ? ["--json"] : [])],
      timeout: 300_000 },
  ),
  {
    name: "psx_loop_trace",
    label: "PSX Loop Trace",
    script: "loopTrace.ts",
    description:
      "What GCC's loop optimizer decided, read off its own `-dL` log rather than reconstructed from " +
      "the pass source. Every movable with its `savings`, `lifetime`, flags and decision; every biv " +
      "and giv with the combine chain and the pseudo it became; and the preheader reassembled in " +
      "emission order — movables first, then giv initialisations, per pass — which is the layout a " +
      "preheader-order residual is actually about and which the assembly does not show. It also " +
      "solves for `threshold`, which loop.c never prints and which decays by 3 after every movable " +
      "it moves: two movables with identical savings and lifetime in one loop can decide differently " +
      "for that reason alone, so reading them as a contradiction throws away the tightest evidence in " +
      "the log. Once the threshold is pinned, every decision is reported as arithmetic — the product " +
      "it needed against the product it had. CANDIDATE-SIDE: there is no loop dump for a binary " +
      "nobody compiled, so this says what your program's loop pass did and the residual says how the " +
      "original's differed. Read it whenever the residual is instruction position in a loop preheader, " +
      "or whenever a hoist appears or fails to appear. Pass `source` for a parked function, whose own " +
      "file is a stub. `threshold` alone prints the running record across every function traced so far.",
    parameters: Type.Object({
      functionName: Type.Optional(FUNCTION("Exact function symbol to trace")),
      source: Type.Optional(Type.String({ description: "Alternate source to compile instead of the function's own file" })),
      threshold: Type.Optional(Type.Boolean({ description: "Print only the running threshold record; omit functionName" })),
      json: JSON_FLAG,
    }),
    argv: (p) => [
      ...(p.threshold && !p.functionName ? ["--threshold"] : []),
      ...(p.functionName ? [p.functionName as string] : []),
      ...(p.source ? ["--source", p.source as string] : []),
      ...(p.json ? ["--json"] : []),
    ],
    timeout: 300_000,
  },
  functionTool(
    "psx_experiment_ledger", "PSX Experiment Ledger", "experimentLedger.ts",
    "Every measurement already taken on this function: the source, the staged residual key, and the compiled-output hash. Read it BEFORE forming a hypothesis — it says which levers are closed and, more usefully, which distinct-looking sources compile to the same words and are therefore the same experiment. `psx_residual_objective` appends to it automatically, so it is the session-to-session memory the research notes could not be.",
  ),
  functionTool(
    "psx_idiom_search", "PSX Idiom Search", "idiomSearch.ts",
    "Target assembly in, matched C out. Query with the *original* assembly of the function you are working — the thing you have on day one — and get back the already-matched functions whose original code has the same instruction shapes, with the C that produced them. Every other retrieval in this project runs the other way round and needs the answer to ask the question. Use it before writing the first draft (whole-function query: what does this kind of code look like when this author writes it) and when a block's residual will not move (--block N: which function already got this block right). The output is an alignment — 'N of its M shapes align in order' — never a similarity score, so you can check it against the two listings. Shapes keep register class and bucket immediates, so one idiom over two different globals is one shape. Functions whose C hands work to the assembler are excluded from the corpus by construction; per-file flag overrides are kept, with a fingerprint, and a cross-flag hit says which residual axes it can still speak to.",
    { functionDescription: "Function whose target assembly is the query",
      extra: {
        block: Type.Optional(Type.Number({ description: "Query one basic block instead of the whole function" })),
        tier: Type.Optional(Type.Number({ description: "0 shape (default, most precise), 1 op class (survives an assembler-macro difference), 2 structure" })),
        limit: Type.Optional(Type.Number({ description: "How many hits to return (default 5)" })),
        source: Type.Optional(Type.Boolean({ description: "Print the whole C of the top hit" })),
      },
      argv: (p) => [p.functionName as string,
        ...(p.block === undefined ? [] : ["--block", String(p.block)]),
        ...(p.tier === undefined ? [] : ["--tier", String(p.tier)]),
        ...(p.limit === undefined ? [] : ["--limit", String(p.limit)]),
        ...(p.source ? ["--source"] : []),
        ...(p.json ? ["--json"] : [])],
      timeout: 300_000 },
  ),
  {
    name: "psx_residual_signatures",
    label: "PSX Residual Signatures",
    script: "residualSignatures.ts",
    description:
      "The same residual shape, in another function. A block's residual signature is the shape of its difference independent of where it sits, so two blocks that carry the same one are the same problem written twice — and where one of them was closed, the index shows the diff of the C edit that closed it. That is a proven answer for the shape in this codebase, which is worth more than any model of the compiler. Read it when a block's residual is not obviously yours; `psx_residual_objective` records the signatures automatically.",
    parameters: Type.Object({
      signature: Type.Optional(Type.String({ description: "Show only this shape" })),
      functionName: Type.Optional(FUNCTION("Show only shapes this function carried")),
      json: JSON_FLAG,
    }),
    argv: (params) => [
      ...(params.signature ? ["--signature", params.signature as string] : []),
      ...(params.functionName ? ["--function", params.functionName as string] : []),
      ...(params.json ? ["--json"] : []),
    ],
    timeout: 120_000,
  },
  functionTool(
    "psx_record_closed", "PSX Record Closed Direction", "closedDirections.ts",
    "Record what a heavy tool just answered, and read what earlier sessions recorded. An UNSAT from psx_solve_local_allocation, an empty domain from psx_search_source_shapes, a scheduler state that cannot exist — each closes a region of the search space, and each costs minutes to rediscover. Call it with no flags to read the record before forming a hypothesis; call it with --tool/--question/--verdict/--result after any heavy tool returns. Record `conditionalOn` with every impossibility: an impossibility is conditioned on its inputs — the compiler state you measured it under, the origin you assumed — and a row that does not say so is read by the next session as unconditional and never re-opened. Two rows on one function closed it for six sessions that way; both proofs were sound and both premises were wrong. `psx_experiment_ledger` prints the record above the measurements, so a direction closed once is closed for every later session, model and context.",
    { functionDescription: "Function the question was asked about",
      extra: {
        tool: Type.Optional(Type.String({ description: "Tool that answered it, by its psx_ name" })),
        question: Type.Optional(Type.String({ description: "The question asked, in one line" })),
        verdict: Type.Optional(Type.String({ description: "closed | open | inconclusive" })),
        result: Type.Optional(Type.String({ description: "The tool's own words for its result — UNSAT, 'no candidate', a count" })),
        evidence: Type.Optional(Type.String({ description: "How a later reader checks this without re-running: bounds, counts, run time" })),
        conditionalOn: Type.Optional(Type.String({ description: "The premise the verdict rests on, so a later session attacks the premise rather than re-running the proof" })),
      },
      argv: (p) => [p.functionName as string,
        ...(p.tool ? ["--tool", p.tool as string] : []),
        ...(p.question ? ["--question", p.question as string] : []),
        ...(p.verdict ? ["--verdict", p.verdict as string] : []),
        ...(p.result ? ["--result", p.result as string] : []),
        ...(p.evidence ? ["--evidence", p.evidence as string] : []),
        ...(p.conditionalOn ? ["--conditional-on", p.conditionalOn as string] : []),
        ...(p.json ? ["--json"] : [])] },
  ),
  functionTool(
    "psx_residual_objective", "PSX Residual Objective", "residualObjective.ts",
    "Score candidate sources on the staged, per-block residual and rank them. This is the iteration metric: the byte score is not a distance, so an edit that fixes the cause of a difference rotates the register assignment downstream and scores worse while moving closer. Verdicts are better / worse / traded (lost an earlier term, won a later one — keep as a branch) / same / identical (byte-identical output, not a new experiment) / EXACT. It also names the block to work next and which other blocks one fix should close. Use `diffFunc` for the terminal MATCH verdict, never for choosing between variants.",
    { extra: {
        source: Type.Optional(Type.Array(Type.String({ description: "Candidate source to score" }), { description: "One or more candidate sources" })),
        dir: Type.Optional(Type.String({ description: "Score every .c file in this directory" })),
        block: Type.Optional(Type.Number({ description: "Rank for this basic block rather than the whole function" })),
      },
      argv: (p) => [p.functionName as string,
        ...((p.source as string[] | undefined) ?? []).flatMap((path) => ["--source", path]),
        ...(p.dir ? ["--dir", p.dir as string] : []),
        ...(p.block !== undefined ? ["--block", String(p.block)] : []),
        ...(p.json ? ["--json"] : [])],
      timeout: 900_000 },
  ),

  /* ---- doctrine, served one sheet at a time ---- */
  {
    name: "psx_reference",
    label: "PSX Reference Sheet",
    script: "reference.ts",
    description:
      "One mechanism sheet from the matching doctrine, chosen by the pass that owns the residual. Call with no topic to list the sheets and what each answers; call with `population`, `schedule`, `allocation`, `declarations`, `flags`, `sdk` or `stuck` — or with a residual owner the pipeline reversal printed, such as `greg` or `sched2`, which resolves to the right sheet. Load the sheet the evidence points at and only that one: the doctrine used to be a single mandatory file, and reading all of it spent context on passes that did not own the residual.",
    parameters: Type.Object({
      topic: Type.Optional(Type.String({
        description: "Sheet name or residual owner. Omit to list the sheets.",
      })),
    }),
    argv: (p) => (p.topic ? [p.topic as string] : []),
    timeout: 30_000,
  },

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
