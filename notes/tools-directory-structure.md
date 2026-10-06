# Tools Directory Structure

*Includes the deterministic resource extractor and parser-only TUI workflow.
The standalone SDK agent loop and auto-committing orchestrator were removed.
Known-format extraction makes no model calls; parser development is explicitly
requested. Neither resource workflow commits or resets unrelated work.*

All custom tooling is TypeScript, run via `npx tsx tools/<group>/<name>.ts`.

```
.pi/              project-local Pi commands and game-agnostic PSX workflow skills
tools/
├── agent/         decompilation diagnostics and context helpers
├── build/         the `make split` pipeline (binary → buildable project)
├── diagnostics/   progress reports, whole-binary diffs, one-shot analysis
├── lib/           shared constants module
└── vendor/        vendored repos and SDK data
```

---

## .pi/ — the interactive decompilation workflow

Pi owns model selection, authentication, sessions, retries, compaction, and the
standard coding tools. Project-local resources add only reusable PlayStation
matching behavior:

| Path | Role |
|---|---|
| `.pi/extensions/psx-decomp/index.ts` | Registers single-function commands, `/decomp-status`, `/auto_decompilation_loop`, and all focused tools. |
| `.pi/extensions/psx-decomp/tools/*.ts` | Bounded-output Pi wrappers around m2c, function diffing/classification/tracing, call-graph generation, context export, full verification, and deterministic function finalization. |
| `.pi/extensions/shared/*.ts` | Shared source-policy, verification, call-graph, process, and Git helpers retained for the in-session loop and focused tools. |
| `.pi/autoloop.json` | In-session loop settings and the shared source-policy and scope-gate configuration. |
| `.pi/skills/psx-decompile-function/SKILL.md` | Fresh/resumed per-function matching workflow. |
| `.pi/skills/psx-refine-function/SKILL.md` | Evidence-backed refinement of one already-matching function. |
| `.pi/skills/psx-project-refinement/SKILL.md` | One conservative cross-file cleanup batch with full verification. |
| `.pi/extensions/psx-resources/index.ts` | Registers `/extract-resources`, `/build-resource-parser` and four focused resource tools; no startup agent work. |
| `.pi/extensions/psx-resources/controller.ts` | Zero-model extraction wrapper; one explicitly requested parser work item, one skill dispatch, cancellation, scoped writes and tool restoration. |
| `.pi/extensions/psx-resources/tools/` | Bounded focused schemas and fresh deterministic CLI processes via stdin, loading new parsers without another session or TUI reload. |
| `.pi/skills/psx-build-resource-parser/SKILL.md` | Pure plugin, registration, media export and corresponding tests through the parser-tested gate; no commits or implicit draft restoration. |

The skills derive game and toolchain facts from the active project's
instructions, generated profile, and configuration. Decompilation and resource
workflows do not commit. The in-session loop uses the shared verification and
source-policy gates.

## tools/agent/ — decompilation support tools

Eligible CLIs here are registered as Pi tools. Decompilation wrappers live
in `.pi/extensions/psx-decomp/tools/`; additional tools use its `TOOL_SPECS`
table in `diagnostics.ts`. The four resource CLIs are owned instead by
`.pi/extensions/psx-resources/tools/`. Registration coverage combines both
registries and explicit exclusions, without duplicate ownership. One CLI is one tool —
a tool's subcommands stay parameters of that tool. `registration.test.ts`
fails if any CLI under `tools/agent/` is left unregistered, because a tool
reachable only as an `npx tsx` line is invisible to anything reading the tool
list, which is how a diagnostic gets built and then never used.

They are still runnable by hand as `npx tsx tools/agent/<file>.ts`.

| File | Role | Entry point? |
|---|---|---|
| `diffFunc.ts` | **The per-function oracle.** Compiles one function through the configured compiler/assembler pipeline, then hands the object to `tools/lib/functionOracle.ts`, which relocates it to the original addresses and compares it with the original image's own bytes. Reports an LCS-aligned diff (single insertions stay localized instead of desynchronizing every later line; count deltas are decomposed by mnemonic) and a verdict of MATCH / MISMATCH / UNDETERMINED. Flags: `--watch`, `--columns`, `--src <file.c>`, `--bytes`. | **Yes** — `npx tsx tools/agent/diffFunc.ts <func>` |
| `explainDiff.ts` | Classifies structural mismatches so matching starts from a fix class rather than random edits. Also runs two semantic gates from `webAnalysis.ts`: register-web parity (missing/extra pseudos ⇒ source-semantics problem, not an allocator problem) and value-provenance auditing (same register NAME, different defining instruction). Prints an `SDK OPERATION-BOUNDARY CANDIDATE` section **above** the classification when the residual overlaps a PSY-Q packet region the source expands by hand; everything below it is provisional until the boundary is restored, because a classification derived from a hand-expanded packet describes a program the original build never compiled. | **Yes** |
| `triage.ts` | Pre-flight symptom detectors for one function, runnable on a bare `INCLUDE_ASM` stub. The SDK finding is emitted ahead of the inventory and allocation findings on purpose: operation recovery outranks compiler-state tuning. The flag-fingerprint finding downgrades to info when a freshness-checked `flagProbe` report shows the current source does not support the hypothesis, and keeps the target fingerprint as evidence either way. `phony-loop` runs before the preheader-order reading, because a loop the pass never scanned invalidates that reading's whole subject; it fires when the residual is inside that nest or at its preheader, and reports the residual's position as its own evidence. `cluster-donor` runs the loop pass over every member of the group `notes/file-groupings.md` records — a matched source or a preserved parked attempt — against the union over this function's own measured programs, one per distinct residual key from the ledger, and reports where a sibling reduced a giv shape this program was refused, or reached a pass-2 emission it has not, quoting the lines of C that produce it; it needs no source of its own, which is the state a parked function is in when it is worth most. | **Yes** |
| `sdkIdioms.ts` | Recognizes PSY-Q packets in a target: primitive initializers (matching a base code with the header's own attribute masks stripped, so `setPolyF4` + `setSemiTrans` is not invisible), command packets with their command word inverted back to arguments, and complete two-halves tag links. Objects are grouped by traced base-register web, so a reused hard register never merges two packets. Every SDK fact — sizes, offsets, command values, attribute masks, macro expansions, the struct a command macro builds — is parsed from the configured header at run time. Reports compatibility, never provenance. | **Yes** |
| `flagProbe.ts` | Early per-file flag-hypothesis check from target fingerprints, a flag matrix over the current source, and nearby overrides. Writes a structured `build/flagProbe/<function>/report.json` carrying the fingerprints, the matrix, and a conclusion of `supported` / `not-supported-current-source` / `inconclusive` with source, target, and toolchain hashes. The conclusion is scoped to the measured source and never claims a flag is irrelevant to every source shape. | **Yes** |
| `webAnalysis.ts` | Shared def/use, register-web, shape-alignment, provenance, and basic-block library behind the explainDiff gates, the target-schedule web-parity gate, `mineStatementOrder.ts`, and `scanReadBeforeDef.ts`. | Library only |
| `mineStatementOrder.ts` | Reads suspected source statement order off a target function's emission order per basic block (hi16 address-formation order ≈ first-use order of globals, stack-slot store order ≈ assignment order, delay slot ≈ last-born statement). Generalizes the store-block doctrine. | **Yes** |
| `scanReadBeforeDef.ts` | Label-aware CFG scanner for registers read before any definition or after call clobber — the register-variable / handwritten-assembly fingerprint classes. `--all` sweeps every nonmatching function. | **Yes** |
| `compilerTrace.ts` | Captures note-aware RTL stage metadata and loop depth alongside typed pseudo provenance, exact `.greg` allocno order, allocation hazards, target-register recurrence, and scheduler decisions for stubborn mismatches. It can also parse an existing isolated GCC dump directory without invoking cc1 again. | **Yes** |
| `analyzeTargetSchedule.ts` | Aligns target/candidate machine instructions through proven zero-width RTL nodes, reconstructs exact legacy-scheduler priority/dependency/LUID ties, validates baseline replay, checks candidate-DAG target legality, and performs bounded target-order counterfactual replay before emitting scheduling, allocation, and delay-slot requirements under `build/targetSchedule/`; reusable artifact-driven analysis, profiles, and deltas live under `target-schedule/`. Allocation-swap requirements are gated on register-web parity: when the pseudo web sets differ, they are downgraded to soft/inferred with an explicit caveat instead of directing the loop toward allocator research. | **Yes** |
| `analyzeAllocatorCounterfactual.ts` | Refines target hard-register roles to UID-local `.lreg` pseudo webs, verifies the exact GCC 2.95.2 `global.c` allocno-priority order, reconstructs incoming hard-register lifetimes, distinguishes explicit-hard and overlapping-allocated-pseudo blockers, and emits bounded reference/live-length thresholds when global order is actionable. Writes diagnostic-only artifacts under `build/allocatorCounterfactual/`; reusable logic lives under `allocator-counterfactual/`. | **Yes** |
| `instrumentCompilerOracle.ts` | Generates and Docker-builds an isolated diagnostic GCC 2.95.2-psx under `build/`, verifies baseline code generation against the configured compiler, exposes private scheduler/local-allocator state as JSONL, and runs dependency plus legal local-assignment counterfactuals. It never modifies the production compiler, vendored source, or C source. Reusable logic lives under `compiler-oracle/`. | **Yes** |
| `analyzeLocalAllocationOracle.ts` | Replays exact block-local quantity formation and every stock `find_free_reg` choice from compiler-oracle events, then classifies requested target registers as legal allocation choices or lifetime/class problems. | **Yes** |
| `minimizeLocalAllocation.ts` | Iteratively and then leave-one-out minimizes diagnostic pseudo-local candidate exclusions required to reproduce target local assignments. The exclusions are occupancy requirements for clean-C synthesis, never source solutions. | **Yes** |
| `solveLocalAllocationState.ts` | Searches bounded abstract local quantities against the exactly replayed allocator, preserving existing assignments while deriving missing allocation slots, lifetime windows, selected hard registers, GCC priority bands, and feasible reference counts. Phantom quantities constrain clean-C synthesis and are never emitted as source. | **Yes** |
| `inspectLocalAllocationVariant.ts` | Applies the exact local-allocation replay to one preserved complete-C hypothesis and prints block-focused quantities, lifetimes, references, candidate order, choices, and target score. This is the narrow allocator-requirement gate for source experiments. | **Yes** |
| `searchSchedulerState.ts` | Builds a function-agnostic finite constraint problem for one validated scheduler block, searches birth boosts, realizable LUID relations, bounded coalescible phantom copies, and justified optional edges, and emits reproducible SAT/UNSAT/INCONCLUSIVE artifacts plus a clean-C source-search handoff under `build/schedulerConstraint/`; reusable logic lives under `scheduler-constraint/`. | **Yes** |
| `searchSourceShapes.ts` | Exhaustively evaluates an explicit finite exact-edit source grammar with policy validation, staged deduplication, bounded workers, checkpoints/resume, requirement-aware ranking, pass tracing, per-trace-class target-schedule profiles/deltas, and full assembly confirmation; reusable logic lives under `source-shape-search/`. It can protect inherited empty memory barriers while rejecting edits that touch or add them, and it protects inherited translation-unit-owned generated-global definitions on the same terms. | **Yes** |
| `synthesizeSourceShapes.ts` | **Superseded; scheduled for removal.** Derives a bounded requirement-guided clean-C grammar from target-schedule evidence and a conservative lossless top-level C89 prologue model, then optionally executes it through `searchSourceShapes.ts`; reusable logic lives under `source-shape-synthesis/`. Its prologue-only model can represent 35 of the 180 decompiled C functions; `searchResidualSourceSpace.ts` models the whole function and subsumes it. Prefer that tool. See `plans/residual-source-search-completion.md` Deliverable 1. | **Yes** |
| `searchResidualSourceSpace.ts` | Automatic exhaustive residual source-space search: from one function name it builds an immutable baseline bundle, a whole-function C89 semantic graph over a vendored tree-sitter front end whose grammar hash enters run identity, a diff-seeded causal closure with reason paths, and a versioned finite grammar (web split/merge partitions, dependency-valid statement orders, declaration-birth forms, verified known-macro component splits, diff-named constant materialization, witness-activated administrative copies, loop-update placement, switch↔if/else-if forms, and SDK-call order over adjacent verified macro calls with publication barriers around `addPrim`; other strata recorded as suppressed), then exactly counts, deterministically enumerates, shards, checkpoints, and evaluates the domain against the byte-identical object oracle with honest exact/exhausted/incomplete/unsupported/too-large terminal states; reusable logic lives under `residual-source-search/`. It locates the function definition past comment mentions and forward prototypes, and it protects inherited translation-unit-owned generated-global definitions while still refusing any a candidate introduces. | **Yes** |
| `reconstructFunction.ts` | Automatic matching reconstruction from the original bytes alone (plans/automatic-matching-reconstruction.md, plans/matching-reconstruction-call-signatures.md): decodes and symbolically executes the target into a decision DAG, fits one of the supported relation classes — fixed-bound record scans, straight-line store/return effects, bounded guarded decision trees, multiply/divide/hi-lo effects, call effects through a callee-signature oracle (matched def, SDK prototype, ABI frame evidence, plus bounded inferred-signature enumeration for named undecompiled callees), over absolute, argument-pointer, and loaded-pointer storage — derives origin/layout alternatives from independently witnessed accesses across the whole container (the access index under `build/matchingReconstruction/access-index/`), constructs typed clean-C candidates for each origin × layout × control combination, and verifies them through the production compiler and the relocated-byte oracle. Terminal states are explicit — exact-candidate, unsupported-target (with the blocking instructions), context-unresolved, domain-exhausted, budget-exhausted — and a winner is a bundle under `build/matchingReconstruction/<fn>/`, never an edit to live sources. Reusable logic lives under `matching-reconstruction/`. | **Yes** |
| `familyTransfer.ts` | Family retrieval, anti-unification and instantiation, all keyed on the shape of the ORIGINAL WORDS so a bare `INCLUDE_ASM` stub is a valid query. Two functions are one family when their words agree everywhere except at holes — symbol references, call targets, displacements, immediates, shift amounts; anti-unification reduces a pair to a constrained substitution (one donor value maps to one target value everywhere it occurs, or the transfer is refused), which is applied to the donor's tree-sitter AST rather than to its text. Ambiguous readings are enumerated and decided by the relocated-byte oracle, never picked. `--family` replays a whole family so a capability is measured over its members; `--survey` reports which families already have a donor and which wait on one representative. Candidates land under `build/familyTransfer/` with their substitution list and integration plan; nothing is promoted. Reusable logic lives under `family-transfer/`. | **Yes** |
| `machineIr.ts` | The CFG / SSA / region spine over the original words: basic blocks with delay slots placed in the branch's own block, dominators and postdominators, natural loops with latches and exit edges, loop nesting, shared tails, irreducible cycles named rather than approximated, SSA values with phis at joins, explicit memory versions and effects. Its size is proportional to the GRAPH, not to the paths through it, which is what makes it answer where a path-shaped route reports a state, step or decision-depth budget. An unmodelled word becomes an opaque value and blocks proofs through itself; the rest of the function is still recovered. Constructs no C. Reusable logic lives under `machine-ir/`. | **Yes** |
| `recipeAtlas.ts` | The compiler as evidence rather than as a yes/no oracle: compiles a catalogue of deliberately chosen small C constructions (loop forms, result forms, dispatch shapes, shared tails, constant and variable divisors, constant multiplies, aggregate copies, storage origins, global-table loops) under the PRODUCTION flags and indexes what each emits, whole-function and per loop, on a register-normalized shape key. A query returns constructions known to produce a target's words, with the constants that differ. A hit is a hypothesis, never a claim about the original; constructions that compile to identical words are both kept and reported (`--coincident`), which is also the honest bound on what a shape lookup can distinguish. Per flag column. Reusable logic lives under `recipe-atlas/`. | **Yes** |
| `nearMissRepair.ts` | Turns a residual into a source move. Every differing address is placed in a basic block of the target's own graph and described by its role — a branch's test, a loop body, a shared tail, the return path — and the recipe atlas is queried for constructions this toolchain compiles to those words. The output is bounded moves ordered by cost: transfer from a family donor, rewrite one region as a recognised construction, try the other loop form, try the factored against the duplicated shared tail. Words outside the model are named as out of reach of any source edit. Nothing is scored: the residual is useful inside a fixed interpretation and is not evidence the interpretation is right. | **Yes** |
| `campaignRun.ts` | An unattended reconstruction campaign to a fixed point. Each unmatched function goes through the cheapest route that could settle it (family transfer, then reconstruction); a success is verified and **published to the recovered-artifact overlay** under `build/recoveredOverlay/`, which moves a revision that the donor index, the evidence graph and the signature cache are all keyed on — so the next round asks a different question rather than repeating the one that failed. `--overlay` reports what is published, `--retract [fn]` unpublishes. A success requeues ONLY its dependents — callers, family, functions sharing a global — which is what makes the loop converge instead of re-running the project. Writes nothing to `src/`: exact candidates land under `build/` with integration plans, and `--bundles` writes a prepared bundle per unfinished function carrying the draft or the honest absence of one, the recovered context, the residual placed in the target's blocks, the closed experiments with what reopens them, the next bounded work item and an integration plan. `--graph` reports the dependency relation; `--bundle <fn>` prepares one bundle. Budget stops keep everything settled. Reusable logic lives under `campaign/`. | **Yes** |
| `fuzzVariants.ts` | Runs preserved mechanism hypotheses side by side, optionally locating their first note-aware `rtl`→`dbr` divergence; reusable logic lives under `variant-lab/`. Leads with a `BYTE-EXACT CANDIDATE FOUND` banner naming every exact result and its next command, orthogonal to the mechanism verdict: an exact candidate stays `inconclusive` when pass tracing was off, and both statements are true at once. A cc1-only exact result is named and marked not promotion-eligible; a normalized score equal to the target count with an unresolved relocation is not called exact at all. The `sdk-call-order` transform template derives the dependency-valid orders of an adjacent SDK macro-call run from the configured header, so an operator names the region and never a permutation list. | **Yes** |
| `loopTrace.ts` | Reads `loop.c`'s own `-dL` log: every movable with its `savings`, `lifetime`, flags and outcome; every biv and giv with its combine chain and the pseudo it became; the preheader reassembled in emission order; and the **cascades** — an insn one pass created out of a nested loop and a later pass re-hoisted out of the enclosing one, which is a route to a pass-2 emission that faces no pass-1 test. It solves for `threshold`, which the pass never prints, keeping a running cross-function record under `build/loopTrace/threshold.json`. A phony loop is reported with the cause read back from the dump's own RTL and with what it voids, because a loop the pass discarded records no decisions at all and its silence is an absence rather than a refusal. Candidate-side: there is no loop dump for a binary nobody compiled. It also attributes decisions to source lines: `emit_note` suppresses the line note without `-g` but still consumes the insn UID, so a second `-g` compile numbers every insn identically and its notes read onto the first's UIDs — verified by comparing the two instruction streams, and refused outright on any difference. Reusable logic lives under `loop-trace/`. | **Yes** |
| `analyzeTargetLoopEmission.ts` | The requirement half, derived from the target's bytes alone so it works on a bare `INCLUDE_ASM` stub. A preheader is a non-decreasing sequence of emission classes (source < pass-1 movable < pass-1 giv init < pass-2 movable < pass-2 giv init), so each group's own evidence is cut down by the ordering into a goal per address, scored MET / NOT MET / UNDETERMINED with a distance. Each goal carries the routes by which the original can have reached a pass-2 emission — decline at pass 1, cascade out of a nested loop, become a reduced giv — with the target-side evidence that opens or closes each, and a precedent index over every function's target bytes — matched, and parked ones with a preserved attempt, each marked as which — names who already emits that order. Scoring a candidate reports the readings of the target's preheader that hold what the candidate did; exactly one is `PINNED`, and the requirement has stopped being a range. Reusable logic lives under `loop-emission/`. | **Yes** |
| `fileGroupings.ts` | Reads suspected same-translation-unit membership out of `notes/file-groupings.md`: a group is a `## ` heading and the match-status-marked bullets under its `Members` list. | Library only |
| `m2cFunc.ts` | Runs m2c on one function's assembly. `--write` writes `src/<func>.c`; `--context` supplies generated signatures. | Library + CLI |
| `type-propagation/` | Original-byte container-qualified evidence graph, CFG/SSA word summaries, SDK/byte-verified AST seed admission, scoped type identities, finite SCC/worklist propagation and partial native m2c inputs. Used by preparation, independent of ranked worklist eligibility. Open targets, unsupported ABI/effects, conflicts and coverage budgets remain explicit. See its README for the incomplete known-dependency acceptance gate. | Library/tests |
| `callGraph.ts` / `callGraphStrategies.ts` | Builds `build/callGraph.json`; in-code strategy selection defaults to dependency-ready/small-first, with the original container-first ordering retained as an alternative. The Pi extension consumes its priorities. Eligibility and loop deferrals remain separate. | **Yes** / library only |
| `contextExport.ts` | Extracts matched signatures into the generated function context header. | Library + CLI |
| `sourcePolicy.ts` | Audits eligible source and current changes for forbidden matching workarounds and modification-scope violations. | **Yes** |
| `cSourceGuard.ts` | AST answers about a translation unit, for tools that move or rewrite C: does it parse, is it safe to place inside a disabled `#if 0` block (no dangling `#endif`/`#else`, no unterminated conditional, no literal running past its line), and which `INCLUDE_ASM` placeholders it declares and for which symbols. Reads the tree-sitter parse, and walks anonymous tokens too, so a MISSING `#endif` or closing quote is visible. | **Yes** |
| `getPrompt.ts` | Legacy standalone prompt builder using archived templates under `prompts/legacy/`; active Pi workflows do not invoke it. | Library + CLI |
| `worktree.ts` | Legacy worktree helper retained for manual experiments; the Pi workflow does not invoke it. | Library only |
| `resourceExtract.ts` | Complete deterministic inventory/scan/decode/export, parser-local checked caches, flat content-deduplicated publication and generated provenance. `npm run extract-assets` / `assets`; supports input/limits/conditional schemas/transforms, force/full verification and explicit legacy migration. | **Yes** |
| `resourceVerify.ts` | Read-only full replay of original extents, complete variant outputs, checked transformations and hash-linked index/generated notes; drift/corruption refuses verification. | **Yes** |
| `resourceAnalyze.ts` | Original PS-X EXE entry/direct-call CFG/SSA and field observations plus bounded hex slices; unresolved mappings/operations remain explicit. Not general loader/schema/consumer recovery. | **Yes** |
| `resourceParser.ts` | Prepare a parser-only baseline and enforce pure source/registration scope, fixed-argv typecheck/all-parser tests and source-drift checks. Accept means parser-tested, not committed. | **Yes** |
| `resource-extraction/` | Reusable deterministic core, registry/plugins and tests. `fingerprints.ts` follows runtime dependencies; `presentation.ts` separates source occurrences from flat published content; `provenance.ts` renders the complete self-contained catalog; `migration.ts` archives only recognized legacy control files and removes verified presentation copies. No Git/asset-approval state. | Library/tests |

Data flow:
`callGraph.ts` → Pi command/skill → `m2cFunc.ts` → `explainDiff.ts` /
`compilerTrace.ts` → `analyzeTargetSchedule.ts` → optional allocator constraints
`analyzeAllocatorCounterfactual.ts` or scheduler-state `searchSchedulerState.ts` → automatic `searchResidualSourceSpace.ts` (price with `--derive-only` first) or,
for a hypothesis its closure does not reach, an explicit `searchSourceShapes.ts`
specification (or small `fuzzVariants.ts` set) → `diffFunc.ts` → full project
check → `contextExport.ts`.

All wrappers are bounded the same way: they accept function names,
project-relative paths, and focused block/budget/depth/version controls, and
derive/resume modes. None can supply shell fragments or promote generated
source.

**Reading C from a tool.** Tooling that inspects, moves, wraps, or rewrites C
source goes through the pinned tree-sitter front end
(`residual-source-search/tree-sitter-c.ts`), not regular expressions over the
text. A pattern match cannot tell a declaration from the same text inside a
comment or a string, and it cannot see the preprocessor structure that decides
whether a rewrite still compiles. `cSourceGuard.ts` already answers the common
questions; extend it rather than re-deriving them. Note that the shared
`subtreeIsBroken` helper walks *named* children only, so it cannot see a
MISSING anonymous token — walk every child when conditional or literal balance
is what you are checking.

This constrains tools, not the C itself. Nothing here changes how a
decompilation session edits `src/*.c` by hand.

## tools/build/ — what `make split` runs

Defined in the `Makefile` split target, in this exact order. All support
`--write` (default is dry-run for the config-mutating ones). Safe to re-run;
bootstrap-era tools are idempotent or no-op when configs exist.

| Order | File | Role |
|---|---|---|
| 1 | `disassemble.sh` | Runs spimdisasm on the EXE → `build/functions/`, `build/functions.csv` |
| 2 | `bootstrap.ts` | Generates `configs/splat/exe.yaml` + `configs/symbols/exe.txt` from scratch when missing (incl. per-function `asm` subsegments); always refreshes `build/sectionLayout.json`. Wraps `analyzeLayout.ts`. The overlay counterpart is `bootstrapOverlay.ts`. |
| — | `analyzeLayout.ts` | Byte-level heuristics classifying spimdisasm entries as code vs data; finds section boundaries. Library of `bootstrap.ts`. |
| 3 | `mergeFragments.ts` | Merges functions spimdisasm split at internal branch targets. Runs **twice** in the split target (before and after lib patching). |
| 4 | `addLibSymbols.ts` | Orchestrator for library detection: runs `detectLibFunctions.ts`, `findMissingLibDeps.ts`, `resolveLibSections.ts`; merges named lib function labels into `symbol_addrs.txt`. |
| 5 | `patchSplatForLibs.ts` | Rewrites splat YAML to use `o` (object) segments for matched PSY-Q lib `.o` files; writes `build/libSections.json`. |
| 6 | `addDepObjects.ts` | Finds `.o` files referenced by matched libs but not themselves matched; adds them as `o` segments. Wraps `findMissingLibDeps.ts`. |
| 7 | `fixCrossFileRefs.ts` | Fixes symbols referenced across `.s` files without global visibility (adds `type:func` entries so next split emits `glabel`). |
| 8 | `patchLinkerBss.ts` | Adds library `.bss` entries to the generated linker script. Wraps `extractBssSymAddrs.ts`. |
| 9 | `patchLibBss.ts` | Patches library `.o` files: converts BSS symbols to `SHN_ABS` absolute addresses (PSYLINK placed BSS symbols independently; GNU ld would pack them). |
| 10 | `classifyGlobals.ts` | Generates `include/globals.h` — the `D_XXXXXXXX` extern declarations with correct GP-relative vs absolute addressing. **Never edit `globals.h` by hand.** |
| 11 | `agent/contextExport.ts --all` | (see agent group) |
| 12 | `genProjectProfile.ts` | Generates `configs/project-profile.md`, the prompt-facing source for concrete target/toolchain facts, from machine-readable sources: EXE header + `splat.yaml` via psxExeInfo, compiler/flags/assembler version from the Makefile, SDK detection, and a byte-identity hash check. Human facts live in `configs/project-info.json`. |
| — | `genDisasmSymbols.ts` | Generates `build/disassembler_symbol_addrs.txt` from `symbol_addrs.txt` (+ `__start` fallback) before every disassembly — a pure derived artifact, hence in `build/`, never committed. Rich symbols give spimdisasm entry points into indirectly-called library code: real names, correct function starts, no phantom blobs. Called by `disassemble.sh` and `bootstrap.ts`. |

### Library-detection internals (called by the above, not run directly)

| File | Role |
|---|---|
| `detectLibFunctions.ts` | Scans the binary against `vendor/psx_psyq_signatures/470/`, cross-checks `lib/*.o` with readelf. Confirmed SDK v4.70: all 342 lib objects match the binary modulo relocations. |
| `findMissingLibDeps.ts` | Finds `.o` dependencies of matched libs; resolves their VRAM addresses by decoding relocations + call targets from the binary. |
| `resolveLibSections.ts` | Locates ROM offsets of matched libs' `.data`/`.rdata`/`.bss` sections. |
| `extractBssSymAddrs.ts` | Computes absolute VRAM addresses of lib BSS symbols from HI16/LO16 relocation pairs. Called by `patchLinkerBss.ts`. |

## tools/lib/ — shared modules

| File | Role |
|---|---|
| `psxExeInfo.ts` | Single source of truth for binary constants (load addr, entry, offsets, GP) derived from the EXE header + `splat.yaml`, plus section-layout loading. Imported by all build/diagnostics tools — nothing hardcodes addresses. |
| `symbolIndex.ts` | Address ↔ symbol in both directions, plus splat subsegment extents, read from the generated artifacts (`symbol_addrs.txt`, the auto symbol tables, splat's data labels, the linker script). A name no table covers resolves to the address splat encoded in it, or to nothing — never to a guess. |
| `functionOracle.ts` | Relocates a compiled object's `.text` to the function's original addresses and compares it word for word with the original image. The diff and the verdict come from that one comparison, so they cannot disagree; an unresolvable relocation is reported as `undetermined` rather than rendered with a guess. Backs `agent/diffFunc.ts`. |

## tools/diagnostics/ — run by hand

| File | Role |
|---|---|
| `progress.ts` | Progress report from splat segments + src scan (`make progress`, `npm run progress`). `--markdown` emits a full per-function table (status/VRAM/size/source/asm links) suitable for redirecting to a file; `--list`, `--remaining`, `--done` filter. |
| `diffBinary.ts` | Whole-binary diff: coverage gaps in .text, linker-map drift vs lib `.o` placements. |
| `headerInfo.ts` | One-shot: parsed the PSX-EXE header into `notes/rom_info/slus_01115_header_info.md`. Done; kept for reproducibility. |
| `matchSignatures.ts` | Standalone multi-version signature scanner. Did its job (proved SDK 4.70 during compiler identification); `build/detectLibFunctions.ts` now does its own 4.7-only scan. Occasional diagnostic. |
| `benchmarkReconstruction.ts` | The reconstruction evaluation harness: named functions, `--parked`, `--census` (every unmatched function, blocker categories by function/byte count, artifact under `build/matchingReconstruction/census.json`), and the frozen-manifest sets (`--freeze-manifest`, `--set development|challenge|held-out`, manifest in `configs/reconstruction/`). The development set enforces per-mechanism expectations and exits non-zero on a regression; `--m2c-baseline` adds the raw-m2c comparison column. Unsupported and noncompiling outcomes stay in the denominator. |
| `feedbackLoop.ts` | Whether a recovery makes the next attempt a different question. Four checked steps: a dependent fails; a producer is recovered from the target's words and verified by the byte oracle; it is published to the recovered-artifact overlay, moving the revision that invalidates the donor index and the signature cache; the dependent succeeds. Runs **cold** by default, so the only thing that changed between the failing attempt and the succeeding one is what the run itself recovered from the binary, and carries a control step showing the constructor alone still cannot close it. Restores the overlay it found. `--warm`, `--json`, or an explicit `<producer> <dependent>` pair. |
| `coldContextEvaluation.ts` | What reconstruction recovers with the recovered *game* C withheld. Runs the same functions in three strata — warm (the tree as it is), cold (matched-definition signatures, the umbrella compile context and family donors all unavailable; toolchain, SDK headers and target artifacts kept), and family-held-out (warm, minus the function's own donors) — and reports the difference plus the functions that depend on recovered context. A warm number answers "how much work is left here"; only the cold one answers "how much can be recovered from a binary". `--set development`, `--sample N`, `--container id`. |
| `typePropagationAcceptance.ts` | Frozen four-root known-dependency baselines, isolated held-out fresh preparations, missing-leaf controls, actual raw AST/ABI and compilation checks, relocated-byte/residual reports, collateral smoke and unchanged-source/resume checks. `--freeze` refuses overwrite; `--run` returns nonzero on cohort failure. No live-source changes, exports or commits. |
| `checkDocReferences.ts` | Reports comments and prose that name a repository file which no longer exists. A dead reference keeps reading as live guidance, so whatever follows it tries to use machinery that is not there and re-reads the same prose instead of converging. Reports repository-rooted paths by default; `--all` adds bare filenames. The tree carries a backlog in historical notes, so gate on `--paths <a,b>` over what a change touched rather than on the whole repository. Exits non-zero on a finding. |
| `analyzeAccess.ts` | **Restored 2026-07-25** (was briefly deleted as orphaned — mistake). Scans the disassembly for every data-symbol reference and classifies by access pattern (`%gp_rel` read/write, absolute read/write, jump table), then infers section types per region. This is the *only* honest `.sdata` detector: position-in-GP-range is necessary but not sufficient (most of `.data`'s tail is in GP range too). On the current binary it finds `.sdata` at `0x8005D3D8`–`0x8005E800` with high confidence — exactly the documented boundary, which no other tool reproduces. Also useful as a cross-check for `classifyGlobals`' addressing decisions. Output: `notes/access-patterns.md` + `build/accessRegions.json` (machine-readable; consumed by `bootstrap.ts` to set `sdataStart`).

## tools/vendor/ — vendored repos & SDK data

### In the live build path

| Dir | Origin | Role |
|---|---|---|
| `old-gcc/` | github.com/decompals/old-gcc | Dockerfiles for old GCC cross-compilers, and the built binaries. The live one is `build-gcc-$(GCC_VERSION)-psx/cc1`, resolved from the Makefile; the other build dirs are compiler-identification-era artifacts. Submodule — this repo cannot add files to it. |
| `gcc/<version>/` | ftp.gnu.org + `old-gcc/patches` | **The source of the compiler in the build path**, one directory per version, patched exactly as the old-gcc recipe patches it and pinned by a tree hash. Which version is live comes from the Makefile's `GCC_VERSION`, so tools resolve the path rather than hardcoding it. Read it with `psx_compiler_source`; it is the authority on every pass-level question and the only way to answer one with a proof instead of an experiment. |
| `maspsx/` | github.com/mkst/maspsx | ASPSX 2.77 shim: translates GNU-as mnemonics and expands `$gp` relocs/macros exactly as the original assembler. In every compile. |
| `splat_ext/` | local (not git) | `o.py` — splat extension enabling `o` (precompiled object) segments; wired via `extensions_path` in `splat.yaml`. Tiny but load-bearing. |
| `m2c/` | github.com/matt-kempster/m2c | asm→C decompiler producing agent first drafts (via `agent/m2cFunc.ts`). |

### Library/SDK data (live, but read-only inputs)

| Dir | Origin | Role |
|---|---|---|
| `psyq47/` | PSY-Q 4.7 SDK (original `Psy-Q_47.zip` + `psyq-4.7-converted-full.7z`) | The actual SDK this game was built with. `converted/lib` holds the ELF-converted libs; **project-root `lib/` is a byte-copy of it** (verified same listing). `DOCS/` has the official 4.7 PDF references (LibRef, LibOver, File Format). `INCLUDE/` is the original SDK headers. |
| `psx_psyq_signatures/` | github.com/lab313ru/psx_psyq_signatures | Per-version PSY-Q signature DBs. Only `470/` is used live (by `build/detectLibFunctions.ts`); the other ~15 version dirs were for SDK identification. |
| `psyq_sdk/` | full SDK dump (314 MB) | Broader dump: beta tools, kanji utilities, sample zips. Reference only — nothing in the build reads it. |

### Reference-only checkouts (nothing in the build reads them)

| Dir | Origin | Role |
|---|---|---|
| `silent-hill-decomp/` | github.com/Vatuu/silent-hill-decomp (181 MB) | Reference decomp project; cited by `notes/compiler-identification.md` and `notes/target-host-compilation.md` for toolchain comparison. Note: its `register __asm__` usage was the (bad) precedent cited in the old style guide. |
| `homebrew-psyq/` | github.com/nocato/homebrew-psyq (70 MB) | Builds gcc-2.8.1_psyq-4.4; used during compiler identification to *rule out* 2.8.1. Era over; not in the build path. |

---

## Notes

- **The two groups of tools have different quality gates.** Build-pipeline
  tools were written when the goal was "get a buildable, verifiable binary" —
  they are solid. The older automation used a byte-only completion gate; the
  project-local Pi skills now make clean-source policy explicit while
  `agent/diffFunc.ts` remains the exact per-function byte oracle (see
  `notes/retros/2026-08-09-asm-folding-root-cause-retro.md`).
- **Deleted in the reorganization** (verified orphaned — zero references):
  `splitFunctions.ts` (superseded by `bootstrap.ts`),
  `splitSegments.ts` (old segment approach),
  `convertToC.ts` (INCLUDE_ASM approach — now a forbidden pattern).
  `analyzeAccess.ts` was deleted in the same sweep but **restored** after its
  value became clear (see diagnostics table).
- Historical session notes (`binary-diff.md`, `maspsx-issue*.md`,
  `compiler-identification.md`, etc.) still reference old flat `tools/` paths —
  they are dated logs and were left as history.
