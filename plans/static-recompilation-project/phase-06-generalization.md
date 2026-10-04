# Phase 6 — Generalization to another binary

**Status: proposed.** Uses the validated pipeline and reproducible workload
harness from [Phase 5](phase-05-realistic-validation.md).
See the [overview](overview.md) for the broader Phase B ambition.

## Goal

Process another PlayStation binary without importing that game's decompiled
source, and establish which capabilities actually transfer.

## Work

1. Select an independent binary/corpus with a stated reason: it should
   exercise meaningful differences in layout, code idioms, SDK identity, or
   overlay behavior rather than merely repeat existing fixtures.
2. Run existing discovery through its adapter and preserve unresolved facts.
   Record any manually supplied context; do not hide project knowledge in a
   claim of cold-binary recovery.
3. Feed the resulting contract to the same semantic recompiler and C backend.
   Missing signatures must not prevent translating otherwise supported code.
4. Classify every blocker at its owning boundary: discovery, instruction
   semantics, C lowering, or runtime implementation.
5. Keep game-specific addresses, containers, and metadata as inputs. Do not
   introduce special cases keyed on a game or function name into semantics.
6. Replay supported workloads against an independent execution reference,
   retaining the first game's regression corpus.

A legitimate new architectural feature may require extending the semantic
core. The important distinction is a reusable capability versus a hidden
per-game patch. Likewise, adding an archive-format hypothesis is discovery
work, not a reason to couple the translator to one game's loader.

## Proposed completion evidence

- The second binary uses the same module contracts and translation path.
- Existing supported semantics transfer without game-specific rewrites.
- Remaining gaps and manual input are explicit and attributed.
- Independent comparisons pass for the declared workloads on both binaries.

One second game is evidence of generalization, not proof of arbitrary-game
coverage. Further claims need a broader corpus with unresolved outcomes kept
in the denominator.

## Not in this phase

Browser delivery, packaging a platform-specific frontend, or requiring a
finished decompilation of the second game.

## Handoff

[Phase 7](phase-07-optimization.md) improves a measured, validated system
rather than optimizing around one game's accidental properties.
