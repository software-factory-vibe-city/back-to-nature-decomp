# Static decompilation: implementation and validation plans

Status: **Task 1 partially implemented; callgraph-driven type propagation is the
active follow-up.** The reported callback draft still fails compilation. Historical
backtests and end-to-end savings have not been demonstrated.

Next: [Callgraph-driven type propagation](callgraph-type-propagation.md).
The [changeset overview](task-01-changeset-overview.md) separates the original
implementation checkpoint from the subsequent corrections and their smoke results.

## Outcome

Make m2c the dependable first-pass path for a fresh function. The thinking agent
receives the actual draft, its context and unresolved questions, and either its
compiler diagnostics or its measured residual. It starts solving, rather than
assembling that starting point itself.

If the draft already matches, the controller performs the full finalization gate
and hands the result directly to the documentation agent. No decompilation-model
turn is needed for that function.

The old m2c repair implementation was removed by Task 1. Keep it removed: no
fallback, renamed substitutions or dependency on the optional second task.

## Plan index

| Plan | Status and purpose |
|---|---|
| [Callgraph-driven type propagation](callgraph-type-propagation.md) | **Active next implementation plan:** follow dependencies recursively and feed justified type constraints into m2c |
| [1. Context and first-pass handoff](01-context-and-handoff.md) | Original contract; partially implemented, not an acceptance certificate |
| [2. Declaration integration](02-declaration-integration.md) | Deferred optional enrichment; not a prerequisite for the core inference correction |
| [Validation: both historical sessions](03-session-backtesting.md) | Deferred historical replay and controlled evaluation; no savings claim yet |
| [Task 01 changeset overview](task-01-changeset-overview.md) | Historical checkpoint and subsequent correction evidence |

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

The historical investigation identified these failures; this list is not a
current implementation-status report:

- Global context loses existing aggregate views; type/prototype context given
  to m2c is not necessarily available to the emitted source's compiler.
- Type harvesting loses nested-overlay/source-local definitions and substitutes
  fictitious concrete layouts for missing types.
- Signature handling can lose pointer/return types or incoming argument slots.
- The historical repair layer introduced declaration conflicts and overlapping
  text edits, while leaving fundamental field-access problems unresolved.
- Some compiling output has incorrect pointer scaling. Context improvements
  alone cannot fix every general decompiler/emitter defect.

A physical-record census confirms both requested sessions are readable. The
second has 6 m2c calls and 1 repair call, versus 27 and 15 in the first. Those
counts are not attempt counts, and are not a counterfactual backtest. Validation
must cover functions that never used m2c as well.

## Delivery order

1. Implement the target-rooted callgraph and bidirectional type-constraint
   propagation in [the active plan](callgraph-type-propagation.md), using the
   reported callback table as a reproduction, not a special case.
2. Feed the resulting facts into m2c and test fresh drafts of known, byte-matched
   functions with real dependencies, including a multi-hop callback chain. Use
   independently audited expected facts and held-out root/intermediate signatures
   to demonstrate propagation. Then run the reported reproduction and secondary
   real-header smoke check. Keep compact handoffs and existing-attempt preservation.
3. Review the already-expanded orchestration separately after the core path works;
   do not add controller or process-lifecycle redesigns to this correction.
4. Undertake historical backtests only as a separately requested validation task,
   with frozen attempt-start inputs and preregistered comparison criteria.
5. Implement/evaluate Task 2 separately if requested. Preparation is already
   enabled by default; this plan does not introduce a new opt-in switch.

General static inference is part of Task 1, but recovering every source type
uniquely is not promised. An unexamined dependency is an incomplete analysis,
not evidence of genuine ambiguity. After graph propagation reaches its explicit
boundary, unsupported effects, conflicts and remaining alternatives must produce
useful discovery material rather than fabricated prototypes.

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
