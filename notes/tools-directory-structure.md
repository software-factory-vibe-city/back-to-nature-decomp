# Tools Directory Structure

*Updated 2026-07-25 for the project-local Pi migration and deterministic
autonomous supervisor. The standalone SDK agent loop and auto-committing
orchestrator were removed; commands, skills, focused tools, and non-committing
transactional automation now live in `.pi/`.*

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
| `.pi/extensions/psx-decomp/index.ts` | Registers single-function commands, `/decomp-status`, `/autodecomp`, and all focused tools. |
| `.pi/extensions/psx-decomp/tools/*.ts` | Bounded-output Pi wrappers around m2c, function diffing/classification/tracing, call-graph generation, context export, full verification, and deterministic function finalization. |
| `.pi/extensions/psx-decomp/autonomous/*.ts` | Durable VRAM-keyed state machine, call-graph scheduler, Pi worker process, watchdogs, source policy, isolated workspaces, patch integration/rollback, retries, refinements, locks, controls, and reporting. |
| `.pi/autodecomp.json` | Sequential autonomous-run models, budgets, cadence, integration roots, and source-policy configuration. |
| `.pi/skills/psx-decompile-function/SKILL.md` | Fresh/resumed per-function matching workflow. |
| `.pi/skills/psx-refine-function/SKILL.md` | Evidence-backed refinement of one already-matching function. |
| `.pi/skills/psx-project-refinement/SKILL.md` | One conservative cross-file cleanup batch with full verification. |

The skills derive game and toolchain facts from the active project's
instructions, generated profile, and configuration. Skills do not commit. The
autonomous supervisor creates detached disposable worktrees, independently
gates candidate patches, applies accepted patches transactionally without
committing, and rolls back a failed trunk gate.

## tools/agent/ — decompilation support tools

Every CLI here is registered as a Pi tool. The one-tool-per-file wrappers live
in `.pi/extensions/psx-decomp/tools/`; the rest are registered from the
`TOOL_SPECS` table in that directory's `diagnostics.ts`. One CLI is one tool —
a tool's subcommands stay parameters of that tool. `registration.test.ts`
fails if any CLI under `tools/agent/` is left unregistered, because a tool
reachable only as an `npx tsx` line is invisible to anything reading the tool
list, which is how a diagnostic gets built and then never used.

They are still runnable by hand as `npx tsx tools/agent/<file>.ts`.

| File | Role | Entry point? |
|---|---|---|
| `diffFunc.ts` | **The per-function oracle.** Compiles one function through the configured compiler/assembler pipeline, then hands the object to `tools/lib/functionOracle.ts`, which relocates it to the original addresses and compares it with the original image's own bytes. Reports an LCS-aligned diff (single insertions stay localized instead of desynchronizing every later line; count deltas are decomposed by mnemonic) and a verdict of MATCH / MISMATCH / UNDETERMINED. Flags: `--watch`, `--columns`, `--src <file.c>`, `--bytes`. | **Yes** — `npx tsx tools/agent/diffFunc.ts <func>` |
| `explainDiff.ts` | Classifies structural mismatches so matching starts from a fix class rather than random edits. Also runs two semantic gates from `webAnalysis.ts`: register-web parity (missing/extra pseudos ⇒ source-semantics problem, not an allocator problem) and value-provenance auditing (same register NAME, different defining instruction). Prints an `SDK OPERATION-BOUNDARY CANDIDATE` section **above** the classification when the residual overlaps a PSY-Q packet region the source expands by hand; everything below it is provisional until the boundary is restored, because a classification derived from a hand-expanded packet describes a program the original build never compiled. | **Yes** |
| `triage.ts` | Pre-flight symptom detectors for one function, runnable on a bare `INCLUDE_ASM` stub. The SDK finding is emitted ahead of the inventory and allocation findings on purpose: operation recovery outranks compiler-state tuning. The flag-fingerprint finding downgrades to info when a freshness-checked `flagProbe` report shows the current source does not support the hypothesis, and keeps the target fingerprint as evidence either way. | **Yes** |
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
| `fuzzVariants.ts` | Runs preserved mechanism hypotheses side by side, optionally locating their first note-aware `rtl`→`dbr` divergence; reusable logic lives under `variant-lab/`. Leads with a `BYTE-EXACT CANDIDATE FOUND` banner naming every exact result and its next command, orthogonal to the mechanism verdict: an exact candidate stays `inconclusive` when pass tracing was off, and both statements are true at once. A cc1-only exact result is named and marked not promotion-eligible; a normalized score equal to the target count with an unresolved relocation is not called exact at all. The `sdk-call-order` transform template derives the dependency-valid orders of an adjacent SDK macro-call run from the configured header, so an operator names the region and never a permutation list. | **Yes** |
| `m2cFunc.ts` | Runs m2c on one function's assembly. `--write` writes `src/<func>.c`; `--context` supplies generated signatures. | Library + CLI |
| `callGraph.ts` | Builds `build/callGraph.json`, including tier and priority ordering used by the Pi extension. | **Yes** |
| `contextExport.ts` | Extracts matched signatures into the generated function context header. | Library + CLI |
| `sourcePolicy.ts` | Audits eligible source and current changes for forbidden matching workarounds and modification-scope violations. | **Yes** |
| `cSourceGuard.ts` | AST answers about a translation unit, for tools that move or rewrite C: does it parse, is it safe to place inside a disabled `#if 0` block (no dangling `#endif`/`#else`, no unterminated conditional, no literal running past its line), and which `INCLUDE_ASM` placeholders it declares and for which symbols. Reads the tree-sitter parse, and walks anonymous tokens too, so a MISSING `#endif` or closing quote is visible. | **Yes** |
| `getPrompt.ts` | Legacy standalone prompt builder using archived templates under `prompts/legacy/`; active Pi workflows do not invoke it. | Library + CLI |
| `worktree.ts` | Legacy worktree helper retained for manual experiments; the Pi workflow does not invoke it. | Library only |

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
| 2 | `bootstrap.ts` | Generates `configs/splat.yaml` + `symbol_addrs.txt` from scratch when missing (incl. per-function `asm` subsegments); always refreshes `build/sectionLayout.json`. Wraps `analyzeLayout.ts`. |
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
