# Phase 7 — Optimize the validated implementation

**Status: proposed.** Uses the cross-binary regression corpus from
[Phase 6](phase-06-generalization.md) and the correctness harness developed
throughout the preceding phases. See the [overview](overview.md) for the
separation of semantics, lowering, and printing.

## Goal

Improve native execution performance and build costs without weakening the
architectural contract or hiding unsupported behavior.

## Measure first

Keep the straightforward translator as a reproducible baseline. Measure
execution time, dispatch overhead, generated source/native-code size, host
compilation time, and memory use on declared workloads. Preserve compiler
settings and inputs with every comparison.

## Candidate optimizations

- Replace proven guest-address dispatches with direct host branches.
- Group blocks into larger translated regions where control flow permits.
- Keep guest register values in host locals and reduce state synchronization
  at boundaries where the full guest state is not observable.
- Specialize memory accesses when ordinary RAM behavior is established;
  never assume away external effects or exceptions based only on an address
  seen in one run.
- Reduce generated source size and translation/compilation overhead.
- Consider another backend, such as LLVM IR, only if measurements justify
  its complexity. Keep the discovery and semantic contracts unchanged.

Region formation and conventional native calls must preserve irregular
control transfers, pending state, exceptions, and overlay identity. Known
function boundaries alone are not sufficient justification.

## Validation

Every optimization runs against the same independent differential corpus and
any applicable translation-validation checks. Compare optimized output both
with the baseline and with the independent reference; baseline agreement alone
can preserve an existing defect.

Keep changes attributable to one mechanism and retain counterexamples as
regressions. A speedup obtained by narrowing the supported execution model is
a different product configuration, not a transparent optimization.

## Proposed completion evidence

Measured improvements on declared workloads, no regression in validated
behavior, and explicit remaining performance/coverage limits. No arbitrary
speed target is committed by this phase sheet.

## Outcome

A reusable static-recompilation pipeline with independently testable modules,
measured coverage, reproducible validation, and justified optimizations.
Platform delivery and complete game-runtime projects remain separate work.
