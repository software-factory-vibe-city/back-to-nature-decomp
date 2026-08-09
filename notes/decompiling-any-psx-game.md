# Decompiling Any PSX Game: The Generalized Bootstrapping Playbook

This project's broader ambition: the pipeline built here for SLUS-01115
(*Harvest Moon: Back to Nature*) should be applicable to **arbitrary PlayStation
games**. This document distills everything learned into a game-agnostic
bootstrapping procedure. Each phase lists its goal, the method, the tools in
this repo that implement it (and how game-specific they are), and the pitfalls
that cost us the most time.

The philosophy, in one sentence: **prove every layer of the toolchain before
decompiling a single function** — because every mismatch later will otherwise be
a three-way ambiguity (wrong C? wrong compiler? wrong assembler emulation?),
and that ambiguity is what makes both humans and LLM agents thrash.

---

## Phase 0 — Acquire and identify the binary

**Goal:** a clean PS-X EXE (or equivalent) and its ground-truth parameters.

- Extract the main EXE from the game disc. Check for **overlays** — many games
  load additional executables at runtime; each is its own decompilation target
  with its own build. Decide scope early.
- Parse the header: `initial_pc`, `text_addr`, `text_size`, payload offset
  (always `0x800` for PS-X EXE).
  - Tools: `tools/diagnostics/headerInfo.ts`, `tools/lib/psxExeInfo.ts` — fully game-agnostic.
- Note that `initial_gp` in the header is usually **zero** — GP must be
  discovered from the code (Phase 2).

**Pitfall:** assuming one EXE = whole game. Check the ISO root and STR/XA
references for additional binaries.

## Phase 1 — Identify the toolchain (the most important phase)

**Goal:** exact compiler version, assembler version, SDK version, optimization
flags — each **proven**, not guessed.

### 1a. SDK identification via strings

Search the binary for:
- `"Library Programs (c) 1993-1997 Sony Computer Entertainment Inc."` → PSY-Q
- Library error strings (`libmcrd: event overflow`, `CdInit: Init failed`, ...)
  → which SDK libraries are linked
- **RCS `$Id:` strings** (e.g. `$Id: intr.c,v 1.75 1997/02/07 ...`) → exact
  library source versions; these are gold for dating the SDK
- Absence of GCC version strings is normal — PSY-Q's compiler doesn't embed one

Reference: `notes/compiler-identification.md`.

### 1b. Compiler version via codegen fingerprints

Heuristics that distinguish GCC versions (all discovered the hard way):

| Fingerprint | Meaning |
|---|---|
| Switch dispatch register: `lw $v0/jr $v0` vs `lw $a0/jr $a0` | **2.8.1 vs 2.95.2** — the single most reliable signal we found |
| Epilog delay-slot SP restore style | *Not* reliable — identical between 2.8.1 and 2.95.2 (we were misled by this for months) |
| `li` expansion: `addiu` for small positives vs `ori` | **ASPSX ≥ 2.56** vs older (assembler, not compiler) |
| Delay-slot fill rate, allocation aggressiveness | Optimization level (`-O2` vs `-O1`) |

### 1c. The gold standard: byte-identity proof

Heuristics only narrow the search. The proof:

1. Obtain the candidate original compiler. PSY-Q `CC1PSX.EXE` binaries circulate
   in SDK archives (we have one in `tools/vendor/psyq_sdk/psyq/bin/`, MD5-verified
   against a second source). Run under Wine if needed.
2. Build the equivalent native compiler via `tools/vendor/old-gcc` (decompals
   Dockerfiles; supports 2.5.7 through 2.95.2, psx patches included).
3. Pick a function with distinctive codegen, decompile it by hand, compile with
   both binaries, and require **byte-identical output from both, matching the
   target**.

Only after this proof can you say: *for every function that was C, matching
source exists.* That fact is the foundation of all later debugging.

### 1d. Assembler version (ASPSX)

The PSY-Q pipeline is `cc1 → aspsx`, and aspsx does macro expansion, load-delay
nop insertion, and **instruction reordering** that gas does not. `maspsx`
(submodule, mkst/maspsx) emulates this; version quirks matter (`--aspsx-version`).
Fingerprint via `li` expansion statistics across the whole binary.
Reference: `notes/maspsx-issue.md`, `notes/maspsx-issue2.md` — and expect to
find *new* maspsx gaps per game (see Phase 6).

### 1e. SDK library version

Match the binary against `tools/vendor/psx_psyq_signatures` (lab313ru) per SDK
version. For us: compiler from PSY-Q 4.6, runtime libs from 4.7 — **mixed
versions are normal**. Tools: `detectLibFunctions.ts`, `matchSignatures.ts`.

**Pitfall summary:** the three-way version space (compiler, assembler, libs)
is independent per axis. Do not assume one PSY-Q release implies all three.

## Phase 2 — First-pass disassembly

**Goal:** function boundaries, GP value, section layout.

1. **Find GP:** disassemble near the entry point, look for the `lui $gp` /
   `addiu $gp` pair. Game-specific value, mechanically discoverable.
2. Run **spimdisasm** (`tools/build/disassemble.sh`) with:
   `--arch-level MIPS1 --compiler PSYQ --gp <value> --disasm-unknown`
   → per-function `.s` files + `functions.csv`.
3. **Classify the layout** (`analyzeLayout.ts`):
   rodata/text/data/sdata boundaries via byte-level heuristics (prologue
   patterns, `jr $ra`, GP-relative access density, branch targets). Determine
   whether sections are **contiguous or interleaved** — this decides how much
   splat pain lies ahead. (BTN: fully contiguous, lucky.)

**Pitfall:** jump tables living in rodata break naive per-function splitting
and crash m2c later. Two fixes, both cheap: pass the rodata file to m2c
alongside the function's `.s` (it accepts multiple inputs, and without the
table it raises `DecompFailure` on the computed jump and yields nothing), and
treat a table whose entries are *function* symbols as a symbol-boundary defect
rather than a dispatch table — those targets are usually case labels inside one
function that the symbol map split apart.

## Phase 3 — A matching build with 0% decompilation

**Goal:** assemble + link the raw disassembly into a byte-identical binary.
**This is the safety net: do it before any decompilation.**

- splat config (`configs/splat.yaml`): section boundaries from Phase 2,
  `gp_value`, and watch `subalign` — splat's default 16-byte alignment can
  shift GP-relative offsets (we needed `subalign: 4`).
- Per-function splitting: one `asm` subsegment per function generated from
  `functions.csv` (`bootstrap.ts` automates this) so functions can later be
  decompiled individually.
- Cross-file branch references will break the build;
  `fixCrossFileRefs.ts` detects them and promotes targets to global labels.
- **Library objects:** fold matched SDK `.o` files into the splat config
  (`addLibSymbols.ts`, `patchSplatForLibs.ts`, `addDepObjects.ts`,
  `findMissingLibDeps.ts`). The original linker (PSYLINK) allocates BSS
  per-symbol independently; reproducing that layout needs explicit patching
  (`patchLinkerBss.ts`, `patchLibBss.ts`, `extractBssSymAddrs.ts`).
- The Makefile shape is game-agnostic: `cpp → cc1 → maspsx → as → ld →
  objcopy → sha256 compare against original payload`. Verification must be a
  single command (`make check`) that anyone — human or agent — can run.

**Exit criterion:** `make check` passes with everything as assembly. From here
on, every change is an incremental, verifiable improvement.

## Phase 4 — Dead-code and library elimination

**Goal:** shrink the problem to the functions that actually matter.

- Signature-matched SDK functions are **dead code** from the decompilation
  perspective — they're already named, understood, and documented. For BTN this
  removed ~45% of functions (223/463) from the workload.
- Build a **call graph** (`callGraph.ts`) over the rest and priority-rank:
  leaf functions and high-fan-in utilities first (they type the codebase),
  complex tier-3 callers last.
- Recognize **handwritten assembly** early: GTE/cop2 code (`rtps`, `lwc2`,
  `cfc2` patterns) was never C. Mark it, keep it as asm, and *never feed it to
  a decompilation agent*. 10–15% of functions in a 3D game.

## Phase 5 — The decompilation loop

**Goal:** per-function, verifiable, incremental C replacement.

Minimum viable infrastructure (all game-agnostic):
- `diffFunc.ts` — compile one `.c`, diff against target, report match %.
  This is the atomic feedback signal for everything (human or agent).
- `progress.ts` — honest progress metrics (functions + bytes, dead code
  excluded).
- `m2cFunc.ts` — mechanical first-pass C via m2c to bootstrap each function.

If automating with LLM agents (this project's experiment):
- Worktree isolation per run (`worktree.ts`) so failures never dirty trunk.
- Context export (`contextExport.ts`) so decompiled functions type each other.
- Prompts with injected assembly/neighbor context (`getPrompt.ts`,
  `prompts/`).
- Escalation tiers: cheap model → strong model → quarantine.

**The matching playbook** (what the agent/human actually does):
classify the diff first, then apply the known fix class —

| Diff kind | Fix class |
|---|---|
| Same instructions, different registers | Restructure temporaries, operand order, expression grouping |
| Same instructions, different order | Statement order, sequence points, comma expressions |
| Different instruction selection | Signedness, idiom strength (`*8` vs `<<3`), cast placement |
| `lui` grouping / self-clobbering loads | Global access pattern, temp reuse across statements |
| Different stack frame | Local variable count/order/spills |

## Phase 6 — Governance (the phase we learned to add last)

**Goal:** keep "matching" honest as the codebase and automation scale.

These are the lessons that cost the most; they are fully game-agnostic:

1. **The gate must reject hacks, not just verify bytes.** A byte-match-only
   gate rewards `__asm__` embeds, register pinning, and per-file flag
   overrides. Reject all three by default; require explicit human allowlisting.
   (`notes/retros/2026-08-09-asm-folding-root-cause-retro.md` — the full postmortem.)
2. **Periodically re-test old hacks.** Compiler-version corrections (our
   2.8.1 → 2.95.2 switch) invalidate yesterday's load-bearing hacks. A
   mechanical strip-and-retest sweep is cheap and pays off every time.
3. **Beware example contamination.** If your tooling feeds already-matched
   code to agents as context, hacks propagate as "accepted practice."
   Curate what enters the context window.
4. **Maintain a toolchain differential.** When a function resists all C-level
   approaches, compile the candidate through the *original* tools (Wine
   CC1PSX + ASPSX) vs the open pipeline (cc1 + maspsx). Divergence with
   identical compiler output = assembler-emulation bug → fix the tool, mark
   the function unmatchable-by-C, and never let anyone (human or agent)
   burn time on it again.
5. **Quarantine is a first-class state.** `nonmatchings/` with recorded diff
   signatures is standard practice in every mature decomp project. The byte
   goal is never at risk; only source cleanliness is.

---

## Effort profile (from BTN data)

| Phase | Nature of work | Reusability across games |
|---|---|---|
| 0–1 | Detective work, high skill, days-to-weeks | Methodology transfers; evidence doesn't |
| 2–3 | Engineering against splat/linker quirks | Tools largely transfer; configs don't |
| 4 | Mostly mechanical | Tools transfer directly |
| 5 | The long tail: months of per-function matching | Playbook + agents transfer |
| 6 | Cheap if built from day one, expensive retrofitted | Transfers completely |

The single biggest lever for a new game is Phase 1 done rigorously: with a
proven toolchain, decompilation is a search problem with a guaranteed solution.
Without it, every failure is ambiguous — and ambiguity is what stalls projects.
