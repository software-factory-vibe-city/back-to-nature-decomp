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

These tools are called directly by humans, Pi skills, and future custom Pi tool
wrappers.

| File | Role | Entry point? |
|---|---|---|
| `diffFunc.ts` | **The oracle.** Compiles one function through the configured compiler/assembler pipeline and diffs against the original. Flags: `--watch`, `--columns`. | **Yes** — `npx tsx tools/agent/diffFunc.ts <func>` |
| `explainDiff.ts` | Classifies structural mismatches so matching starts from a fix class rather than random edits. | **Yes** |
| `compilerTrace.ts` | Captures note-aware RTL stage metadata and loop depth alongside typed pseudo provenance, exact `.greg` allocno order, allocation hazards, target-register recurrence, and scheduler decisions for stubborn mismatches. | **Yes** |
| `analyzeTargetSchedule.ts` | Aligns target/candidate machine instructions through proven zero-width RTL nodes, reconstructs exact legacy-scheduler priority/dependency/LUID ties, validates baseline replay, checks candidate-DAG target legality, and performs bounded target-order counterfactual replay before emitting scheduling, allocation, and delay-slot requirements under `build/targetSchedule/`; reusable logic lives under `target-schedule/`. | **Yes** |
| `searchSourceShapes.ts` | Exhaustively evaluates an explicit finite exact-edit source grammar with policy validation, staged deduplication, bounded workers, checkpoints/resume, requirement-aware ranking, pass tracing, and full assembly confirmation; reusable logic lives under `source-shape-search/`. It can protect inherited empty memory barriers while rejecting edits that touch or add them. | **Yes** |
| `synthesizeSourceShapes.ts` | Derives a bounded requirement-guided clean-C grammar from target-schedule evidence and a conservative lossless top-level C89 prologue model, then optionally executes it through `searchSourceShapes.ts`; reusable logic lives under `source-shape-synthesis/`. | **Yes** |
| `fuzzVariants.ts` | Runs preserved mechanism hypotheses side by side, optionally locating their first note-aware `rtl`→`dbr` divergence; reusable logic lives under `variant-lab/`. | **Yes** |
| `m2cFunc.ts` | Runs m2c on one function's assembly. `--write` writes `src/<func>.c`; `--context` supplies generated signatures. | Library + CLI |
| `callGraph.ts` | Builds `build/callGraph.json`, including tier and priority ordering used by the Pi extension. | **Yes** |
| `contextExport.ts` | Extracts matched signatures into the generated function context header. | Library + CLI |
| `sourcePolicy.ts` | Audits eligible source and current changes for forbidden matching workarounds and modification-scope violations. | **Yes** |
| `getPrompt.ts` | Legacy standalone prompt builder using archived templates under `prompts/legacy/`; active Pi workflows do not invoke it. | Library + CLI |
| `worktree.ts` | Legacy worktree helper retained for manual experiments; the Pi workflow does not invoke it. | Library only |

Data flow:
`callGraph.ts` → Pi command/skill → `m2cFunc.ts` → `explainDiff.ts` /
`compilerTrace.ts` → `analyzeTargetSchedule.ts` → requirement-guided
`synthesizeSourceShapes.ts` or an explicit `searchSourceShapes.ts`
specification (or small `fuzzVariants.ts` set) → `diffFunc.ts` → full project
check → `contextExport.ts`.

The Pi extension exposes bounded wrappers as `psx_analyze_target_schedule`,
`psx_synthesize_source_shapes`, and `psx_search_source_shapes`. They accept only
function names, project-relative JSON paths, focused block/budget/depth/job
controls, derive/resume modes; none can supply shell fragments or promote
generated source.

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

## tools/lib/ — shared module

| File | Role |
|---|---|
| `psxExeInfo.ts` | Single source of truth for binary constants (load addr, entry, offsets, GP) derived from the EXE header + `splat.yaml`, plus section-layout loading. Imported by all build/diagnostics tools — nothing hardcodes addresses. |

## tools/diagnostics/ — run by hand

| File | Role |
|---|---|
| `progress.ts` | Progress report from splat segments + src scan (`make progress`, `npm run progress`). `--markdown` emits a full per-function table (status/VRAM/size/source/asm links) suitable for redirecting to a file; `--list`, `--remaining`, `--done` filter. |
| `diffBinary.ts` | Whole-binary diff: coverage gaps in .text, linker-map drift vs lib `.o` placements. |
| `headerInfo.ts` | One-shot: parsed the PSX-EXE header into `notes/slus_01115_header_info.md`. Done; kept for reproducibility. |
| `matchSignatures.ts` | Standalone multi-version signature scanner. Did its job (proved SDK 4.70 during compiler identification); `build/detectLibFunctions.ts` now does its own 4.7-only scan. Occasional diagnostic. |
| `analyzeAccess.ts` | **Restored 2026-07-25** (was briefly deleted as orphaned — mistake). Scans the disassembly for every data-symbol reference and classifies by access pattern (`%gp_rel` read/write, absolute read/write, jump table), then infers section types per region. This is the *only* honest `.sdata` detector: position-in-GP-range is necessary but not sufficient (most of `.data`'s tail is in GP range too). On the current binary it finds `.sdata` at `0x8005D3D8`–`0x8005E800` with high confidence — exactly the documented boundary, which no other tool reproduces. Also useful as a cross-check for `classifyGlobals`' addressing decisions. Output: `notes/access-patterns.md` + `build/accessRegions.json` (machine-readable; consumed by `bootstrap.ts` to set `sdataStart`).

## tools/vendor/ — vendored repos & SDK data

### In the live build path

| Dir | Origin | Role |
|---|---|---|
| `old-gcc/` | github.com/decompals/old-gcc | Dockerfiles for old GCC cross-compilers. **Only `build-gcc-2.95.2-psx/cc1` is used** (Makefile). The other four build dirs (`2.7.2-psx`, `2.8.0`, `2.8.0-psx`, `2.8.1-psx`) are compiler-identification-era artifacts. |
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
  `agent/diffFunc.ts` remains the exact byte oracle (see
  `notes/next-steps-for-revisiting-the-project.md`).
- **Deleted in the reorganization** (verified orphaned — zero references):
  `splitFunctions.ts` (superseded by `bootstrap.ts`),
  `splitSegments.ts` (old segment approach),
  `convertToC.ts` (INCLUDE_ASM approach — now a forbidden pattern).
  `analyzeAccess.ts` was deleted in the same sweep but **restored** after its
  value became clear (see diagnostics table).
- Historical session notes (`binary-diff.md`, `maspsx-issue*.md`,
  `compiler-identification.md`, etc.) still reference old flat `tools/` paths —
  they are dated logs and were left as history.
