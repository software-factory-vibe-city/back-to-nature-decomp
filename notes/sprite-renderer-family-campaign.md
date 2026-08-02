# Sprite-Renderer Family Campaign

**Goal:** decompile the remaining sprite-renderer family
(0x80015E3C–0x80016B7C, plus the adjacent hook-sharing func_80015704) so we
can reason about this codebase's source idioms — and use that evidence to
explain, shrink, or retire the assembly hybrid on func_80016280, the family's
big renderer.
**Started:** 2026-08-02 (after the func_80016054 breakthrough).

## Why this family, why now

func_80016280 carries the project's largest reconstruction exception: a
39-instruction asm region covering an entry/guard schedule that exhaustive
source search (~290k candidates) could not reach in clean C. In 2026-08 we
closed every toolchain-shaped explanation for that residual (compiler
versions 2.7.2–2.95.2 including a purpose-built 2.95.1, patchlevel source
diffs, strict-aliasing defaults, psx patchset, `-mcpu` scheduler models, and
byte-comparison of maspsx against real ASPSX 2.77/2.86). The residual is a
source-shape question, and the cheapest new constraints are the sibling
functions: same author, same TU or shared headers, same structs.

func_80016054 then demonstrated the value concretely: a "stuck at 28/29"
sibling turned out to be three lines of natural C plus a two-instruction
debug-hook macro — the previous hybrid's residual was caused by its own
asm constraints. See `notes/research/caller-capture-debug-hook.md` for the
recovered macro (`include/debughook.h`), the byte signatures, and the
matching doctrine (null-case rule, prune-to-natural, wall constructs).

## What the family gives us (evidence channels)

1. **Author dialect** — do the siblings need reuse-heavy idioms (like the
   `work` redefinition fingerprint in 80016280's loop) or plain C? This
   calibrates how much of 80016280's odd candidate shape is authorial style
   versus coincidental fit, and re-aims any future residual search.
2. **Shared macro layer** — CAPTURE_RA is recovered; the 0x3C0 getTPage
   x-mask (vs 0x3ff in vendored 4.7 headers) already proves this TU used a
   nonstandard/older header vintage. Sibling matches surface further shared
   expansions for free.
3. **Shared types** — `SourceData`/`Group`/`Header`/`Entry` declarations were
   inferred from one function. Siblings using the same fields can force
   corrections, and type corrections propagate into 80016280's webs and
   allocation — a live path to moving its historical 202/214 clean-C result.
4. **Prologue witnesses** — each matched sibling is certified 2.95.2 output
   from this exact file. If a 5+-arg sibling matches fully, 80016280's
   prologue anomaly is a lone island (hand-tuning plausible); if another
   sibling sticks the same way, it is a file-level phenomenon.
5. **The multi-set mechanism in vivo** — func_800165D8 increments a primitive
   pointer through a parameter (naturally multi-set), which dodges the sched1
   single-set birth boost. Matching it shows the compiler producing the
   early-parameter-copy behavior 80016280's target demands, from real source.

## Member status (address order)

| Function | Status | Notes |
|---|---|---|
| func_80015704 | stub | adjacent, shares CAPTURE_RA; hook pre-solved; FntPrint + busy-wait body — cheapest next match |
| func_80015E3C | matched | thin func_80016280 wrapper |
| func_80015E78 | matched | thin func_800165D8 wrapper |
| func_80015EE8 | stub | packet setup/teardown around func_80016280 |
| func_80015F80 | stub | packet setup/teardown around func_800165D8 |
| func_80016054 | **matched, natural C** | CAPTURE_RA hook wrapper; see research note |
| func_800160C8 | stub | packet setup/teardown around func_800165D8 |
| func_800161AC | stub | packet setup/teardown around func_800165D8 |
| func_80016280 | matched (hybrid) | SPRT/DR_MODE renderer; 214/214; exception under deferred audit |
| func_800165D8 | stub | larger direct-primitive renderer; the heavyweight |
| func_80016B7C | unknown | possible file tail; no semantic evidence yet |

## Working order

1. func_80015704 (hook pre-solved, small).
2. The four setup/teardown stubs (EE8, F80, 160C8, 161AC) — expected to share
   packet idioms; watch for further hook sites and struct-field evidence.
3. func_800165D8 — the second renderer; budget for a real fight, but arrive
   with the family dialect in hand.
4. Revisit func_80016280 per the 2026-08-02 addendum in its research note:
   prune-to-natural audit of the hybrid, then a dialect-informed re-attack on
   the clean-C residual.

## Method doctrine (short form; details in the debug-hook note)

- Compile the null case (no asm) before building or fighting any hybrid.
- Prune to natural after any match; every deviation from natural C must
  justify itself instruction by instruction.
- Memory clobbers and `$sp` operands are scheduling walls; plain volatile asm
  is not a load barrier.
- Move statements, not values: source-statement position (insn LUIDs) is the
  scheduling control; staging locals and dummy asm dependencies are traps.
- Check `notes/file-groupings.md` and update it with new grouping evidence.
