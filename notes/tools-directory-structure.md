# Tools Directory Structure

*Updated 2026-03-23 after the great reorganization: four orphaned tools were
deleted (`splitFunctions.ts`, `analyzeAccess.ts`, `splitSegments.ts`,
`convertToC.ts` — verified zero references in code, Makefile, configs, and
prompts before removal) and everything else was grouped by role.*

All custom tooling is TypeScript, run via `npx tsx tools/<group>/<name>.ts`.

```
tools/
├── agent/         the LLM decompilation loop (day-to-day work)
├── build/         the `make split` pipeline (binary → buildable project)
├── diagnostics/   progress reports, whole-binary diffs, one-shot analysis
├── lib/           shared constants module
└── vendor/        vendored repos and SDK data
```

---

## tools/agent/ — the live decomp loop

These form the LLM-driven matching pipeline. `orchestrator.ts` is the entry
point; the others are its libraries, most of which also work standalone.

| File | Role | Entry point? |
|---|---|---|
| `orchestrator.ts` | Main driver. Reads `build/callGraph.json`, spins up git worktrees, runs agents per function, verifies via `diffFunc.ts`, merges branches `decomp/<func>`. Modes: `--write`, `--top N`, `--func X`, `--stage N`, `--refine`, `--project-refine`, `--fix X`. Dry-run without `--write`. | **Yes** — `npx tsx --env-file=.env tools/agent/orchestrator.ts` |
| `agent-loop.ts` | Thin wrapper over the `@mariozechner/pi-coding-agent` SDK. Exports `runAgentLoop` / `runPlanThenExecute`; streams transcripts; outer retry loop with external success check. Reads `AGENT` / `STRONGER_AGENT` from `.env` (project root). | Library (also standalone CLI for testing) |
| `getPrompt.ts` | Builds per-function prompts: injects asm, m2c output, call-graph context, and `prompts/c-style-guide.md` into `prompts/decompilation-cleanup-agent.md`. Also exports the global/project refinement prompt builders. | Library (CLI prints a prompt to stdout) |
| `worktree.ts` | `WorktreeManager` — per-run git worktree isolation so failed agent runs can't dirty the main checkout; merges successful branches back. Symlinks `tools/vendor/old-gcc` build dirs into worktrees. | Library only |
| `diffFunc.ts` | **The oracle.** Compiles one function through the full pipeline (cc1 2.95.2 → maspsx → as → objdump) and diffs against the original. This is the reward signal every agent optimizes for — and the file the planned "gate" changes (next-steps doc §1) will modify. Flags: `--watch`, `--columns`. | **Yes** — `npx tsx tools/agent/diffFunc.ts <func>` |
| `m2cFunc.ts` | Runs m2c on one function's `.s` to produce the agent's starting draft. `--write` writes `src/<func>.c`, `--context` feeds `include/functions.h`. Imported by orchestrator. | Library + CLI |
| `callGraph.ts` | Builds `build/callGraph.json`: call graph + tier/priority ordering that decides which function the orchestrator works next. | **Yes** — `npx tsx tools/agent/callGraph.ts` |
| `contextExport.ts` | Extracts signatures from matched `src/*.c` into `include/functions.h` so later functions see real prototypes. Imported by orchestrator (`exportContext`); also run as `--all` at the end of `make split`. | Library + CLI |

Data flow:
`callGraph.ts` → `orchestrator.ts` → (`worktree.ts` + `m2cFunc.ts` +
`getPrompt.ts` + `agent-loop.ts`) → verify with `diffFunc.ts` →
`contextExport.ts`.

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
| 12 | `genProjectProfile.ts` | Generates `configs/project-profile.md` (injected into every agent prompt) from machine-readable sources: EXE header + `splat.yaml` via psxExeInfo, compiler/flags/ASPSX version from the Makefile, SDK version auto-detected via `matchSignatures.ts`, byte-identity **verified** by hashing the built binary at generation time. Human facts (game title, evidence note) live in `configs/project-info.json`. |

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
| `progress.ts` | Progress report from splat segments + src scan (`make progress`, `npm run progress`). |
| `diffBinary.ts` | Whole-binary diff: coverage gaps in .text, linker-map drift vs lib `.o` placements. |
| `headerInfo.ts` | One-shot: parsed the PSX-EXE header into `notes/slus_01115_header_info.md`. Done; kept for reproducibility. |
| `matchSignatures.ts` | Standalone multi-version signature scanner. Did its job (proved SDK 4.70 during compiler identification); `build/detectLibFunctions.ts` now does its own 4.7-only scan. Occasional diagnostic. |

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
  they are solid. Agent tools were written when the gate was "bytes match,
  nothing else" — `agent/orchestrator.ts` / `agent/diffFunc.ts` are where the
  planned anti-hack gate work lands (see
  `notes/next-steps-for-revisiting-the-project.md`).
- **Deleted in the reorganization** (verified orphaned — zero references):
  `splitFunctions.ts` and `analyzeAccess.ts` (superseded by `bootstrap.ts` /
  `analyzeLayout.ts`), `splitSegments.ts` (old segment approach),
  `convertToC.ts` (INCLUDE_ASM approach — now a forbidden pattern).
- `.env` holds `AGENT` / `STRONGER_AGENT` configs consumed by `agent-loop.ts`;
  it lives at project root, not in `tools/`.
- Historical session notes (`binary-diff.md`, `maspsx-issue*.md`,
  `compiler-identification.md`, etc.) still reference old flat `tools/` paths —
  they are dated logs and were left as history.
