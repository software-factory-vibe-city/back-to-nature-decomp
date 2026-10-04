# Static decompilation: implementation and validation plans

Status: **planned; no pipeline changes implemented or backtest improvements claimed**.

## Outcome

Make m2c the dependable first-pass path for a fresh function. The thinking agent
receives the actual draft, its context and unresolved questions, and either its
compiler diagnostics or its measured residual. It starts solving, rather than
assembling that starting point itself.

If the draft already matches, the controller performs the full finalization gate
and hands the result directly to the documentation agent. No decompilation-model
turn is needed for that function.

**Remove the current m2c repair implementation entirely as part of Task 1.**
Do not keep it as a fallback, rename its substitutions, or make removal depend
on the optional second task.

## The two workstreams

| Plan | Deliverable | Dependency |
|---|---|---|
| [1. Context and first-pass handoff](01-context-and-handoff.md) | Faithful context, bounded static inference, measured m2c draft, explicit discovery packet, exact-match fast path, repair removal | Independently shippable |
| [2. Declaration integration](02-declaration-integration.md) | Optional structural post-processing that performs justified declaration work and coalesces compatible partial object views | Enriches Task 1; never required by it |
| [Validation: both historical sessions](03-session-backtesting.md) | Historical artifact comparison and controlled agent experiments, with leakage controls | Cross-cutting validation, not a third runtime component |

The division is operational:

- **Before/during m2c:** supply what is known, infer what the original bytes
  justify, and emit faithfully. Do not manufacture types to hide uncertainty.
- **After m2c, optionally:** reconcile the declarations it actually needs with
  the project's existing declarations and publish justified additions.
- **Thinking agent:** discover missing knowledge and solve the remaining
  decompilation problem. It may reject or replace the draft; the packet is not
  a constrained repair script.

Reliable does not mean every assembly function becomes compiling, matching C
without discovery. It means known information is not discarded or contradicted,
uncertainty is visible, and a successful compile is not mistaken for correctness.

## Evidence informing these plans

Read the [initial investigation](../static-decompilation-investigation.md) and
[raw-draft/repair investigation](../../notes/research/static-decompilation-session-2026-10-04.md).

The first session contains 170 attempted functions but only 27 m2c invocations.
All 27 observed raw drafts were recovered. Nine of eleven repair calls requesting
compilation reported compiler errors; the two compiling repairs still mismatched.
Historical preprocessed inputs reproduce those outcomes without today's headers.
The repair-selected sample is not the full session's m2c failure rate.

The established problems include:

- Global context loses existing aggregate views; type/prototype context given
  to m2c is not necessarily available to the emitted source's compiler.
- Type harvesting loses nested-overlay/source-local definitions and substitutes
  fictitious concrete layouts for missing types.
- Signature handling can lose pointer/return types or incoming argument slots.
- The current repair layer introduces declaration conflicts and overlapping
  text edits, while leaving fundamental field-access problems unresolved.
- Some compiling output has incorrect pointer scaling. Context improvements
  alone cannot fix every general decompiler/emitter defect.

A physical-record census confirms both requested sessions are readable. The
second has 6 m2c calls and 1 repair call, versus 27 and 15 in the first. Those
counts are not attempt counts, and are not a counterfactual backtest. Validation
must cover functions that never used m2c as well.

## Delivery order

1. Freeze session inputs and baseline evidence before tuning the new pipeline.
2. Implement Task 1 in vertical slices: faithful context; measured draft packet;
   controller handoff/fast path; retire repair and update active instructions.
3. Validate Task 1 by itself against both sessions and paired agent runs.
4. Implement and evaluate Task 2 as a separately switchable enrichment.
5. Enable each stage by default only after its own acceptance gates pass.

General static inference is part of Task 1, but solving every unknown statically
is not its release condition. Unsupported or ambiguous cases must produce useful
agent-discovery material rather than hold the whole rollout hostage.

## Invariants

- Use the active configuration and
  [generated profile](../../configs/project-profile.md) for target facts,
  compiler flags, container paths and header roles.
- Preserve existing clean-C work on resume. Preparation never silently replaces
  it with a fresh draft.
- Preserve raw m2c output, full diagnostics and input provenance. A bounded UI
  summary must link to complete artifacts.
- Compilation, per-function byte identity and full finalization are distinct
  statuses. Policy, scope and all configured container checks remain mandatory.
- No fabricated layouts, blanket scalar fallbacks, function-specific patches,
  embedded-assembly solutions or speculative compiler flags.
- No hand-edited generated headers, new global redeclarations in source, or
  destruction of tentative definitions needed for translation-unit ownership.
- No automatic commits are introduced. The current documentation skill's commit
  instruction must be reconciled with repository policy before routing the new
  fast path through it; commits still require explicit user authorization.
- Plans, implementation and validation are separate deliverables. Writing these
  plans neither implements the pipeline nor demonstrates time/token savings.

Cache redesign, broad constructor/recipe expansion, worklist changes and general
finalization deduplication remain outside this work. Reusing a preparation
measurement is permitted only when its complete input fingerprint is unchanged.
