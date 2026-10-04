# Phase 5 — Realistic execution and validation

**Status: proposed.** Expands validation already running since Phase 1 over
the connected execution and target features from
[Phase 4](phase-04-target-coverage.md). See the [overview](overview.md) for the
correctness contract and its trust boundaries.

## Goal

Validate realistic workloads and make every divergence reproducible and
localizable, rather than relying on whether a game eventually crashes.

## Work

1. Capture realistic entry states and execution traces from an independent
   validated reference. Record memory, architectural state, code residency,
   external responses/events, and the assumptions needed to replay them.
2. Run translated workloads with identical inputs and controlled events.
   Include longer call chains, callbacks where supported, and overlay changes.
3. Compare registers, pending state, next addresses, memory changes,
   exceptions, and ordered observable accesses—not only final RAM contents.
4. Implement checkpoint-to-block-to-instruction divergence localization,
   retaining original-address to generated-source mappings and all inputs.
5. Add matched-decompilation fixtures where useful. Reconcile host pointer
   widths/layout and compare defined outputs; native C is not a reference for
   every original MIPS temporary register or pipeline state.
6. Explore symbolic translation validation on selected supported blocks.
   State exactly which original semantics and emitted representation are
   compared, the admitted entry states, and remaining trust assumptions.

## What counts as proof

- A counterexample from equivalence checking becomes a regression fixture.
- `UNSAT` establishes equivalence only in the specified model and domain.
- Unsupported cases, timeouts, or incomplete solver runs establish nothing.
- A proof about semantic IR does not automatically validate C lowering,
  the host compiler, or runtime helpers.
- Block composition must preserve boundary state, effects, and transfers;
  proving individual arithmetic expressions is not a whole-program proof.

Keep the claims separate: correct translation of supported code does not
prove that discovery found every possible execution destination.

## Proposed completion evidence

- Declared realistic workloads execute with matching state/effect traces.
- Known injected defects are found and localized to reproducible cases.
- Results record coverage, unresolved features, and execution-model limits.
- Any formal result states its layer, assumptions, and exact scope.

A playable native game additionally requires its external runtime services.
This phase does not require building a graphics/audio frontend merely to
validate the translator, nor can test doubles establish those services'
real-world correctness.

## Handoff

[Phase 6](phase-06-generalization.md) tests whether the same contracts and
semantic core work for another binary without recovered game source.
