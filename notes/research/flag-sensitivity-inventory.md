# Flag-sensitivity inventory and fingerprint calibration (2026-07-31)

Full-corpus sweep validating the flagProbe machinery against every function
decompiled so far. Method: for each of the 466 src files, compile under the
baseline flag set (plus that file's own override, if any) and under four
deltas (-fno-gcse; -fno-schedule-insns{,2}; both; -fno-rerun-cse-after-loop),
strip comments/directives from cc1 output, and compare against the baseline
compile. Baseline output is byte-correct for every function (`make check`
green), so a delta can only equal baseline or diverge from the target.
Fingerprints were decoded from the original executable's bytes.

## Universe

- 466 src files = **148 real decompiled C functions** + 318 INCLUDE_ASM
  stubs (link original asm; trivially flag-invariant — verified: zero stubs
  show sensitivity).

## Flag-matrix results (real C, n=148)

- **110 flag-invariant** across the whole matrix (identical output under
  every delta — no flag evidence derivable from these).
- **38 flag-sensitive** (delta changes output ⇒ the baseline setting is
  required for their byte match ⇒ they are witnesses):
  - `-fgcse` required (nogcse DIFF): func_8001A8D0, func_8001A970,
    func_80022F1C — exactly the three previously known witnesses,
    reproduced independently.
  - scheduling-on required (nosched DIFF): 36 functions (see sweep data;
    includes func_80019070, func_8001FE00, pow_int, Rand, CopyVec3 …).
    SetGfxClip/SetGfxOffset are unaffected because their baseline already
    includes -fno-schedule-insns{,2}.
  - `-frerun-cse-after-loop` required (norerun DIFF): func_8001A970,
    func_8001FF98, func_80024578.
- func_8001FF98 is nogcse-SAME: its final source is gcse-invariant,
  confirming the removed override was unnecessary.

## False-positive proof for the escalation bar

The bar = fingerprint AND a flag column dominating baseline AND no contrary
regional witness. Baseline is byte-perfect for all 148 real-C functions, so
domination is impossible: every delta either equals baseline (no signal) or
diverges from a byte-exact output (strictly worse). Measured result:
**zero of 148 functions pass the bar. No false positives.**

## Fingerprint calibration (the interesting part)

On real decompiled C, both fingerprints have perfect precision for the
"hard class":

- **PRE-fatal shape** (nested loop + in-place bottom increment): fires on
  exactly 3 of 148 — func_8001FF98 (the solved case study),
  func_80021820 and func_80022014 (both still carrying register-__asm__
  pins, i.e. known-unclean). Zero hits on cleanly matched functions.
- **lui/lw self-clobber**: fires on exactly 3 of 148 — SetGfxClip and
  SetGfxOffset (the two documented scheduling overrides, both pinned) and
  func_8001205C (also pinned). Zero hits on cleanly matched functions.

Every fingerprint hit in the decompiled corpus is a documented hard case or
a pinned file. The fingerprints are hard-class detectors, not flag verdicts
— the proven first response to the PRE-fatal shape is the counter-reuse
idiom (style guide s12), not a flag.

## Predictive watchlist (fires on not-yet-decompiled stubs)

Advance warning — these will be the hard class when reached:

- PRE-fatal shape (11): func_80016C08, func_80017300, func_80017F88,
  func_800183E0, func_80019610, func_80019AD0, func_8001AE34,
  func_80020A94, func_80020B80, func_8002206C, func_800223D4.
  First move on each: naive indexed bodies + shared counter (s12).
- Self-clobber shape (42 stubs incl. __start): scheduling-sensitive class;
  compare against SetGfxClip/SetGfxOffset before hand-shaping source.

Raw sweep data: scratchpad flagsweep/results.txt (session-local); method
reproducible from this note. Related:
notes/retros/2026-07-31-func_8001FF98-retro.md, prompts/c-style-guide.md
s11-s12, tools/agent/flagProbe.ts.

## Caveat (same day)

func_80021820's sweep row reflects its pinned 2.8.1-era C, which
byte-matches only with the uncommitted local maspsx delay-slot patch
applied (see notes/maspsx-issue3.md — status pending owner decision). A
stub-flip alternative was tested and rolled back; the corpus count above
(148 real C) reflects the current tree with the pinned C in place.
