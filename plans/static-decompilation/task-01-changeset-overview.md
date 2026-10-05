# Task 01 changeset overview

Status: **historical implementation checkpoint, followed by partial corrections**.
The original sections below describe changeset
`0608df5207a1b3d14818c9ba8c9f769d0a30f4a6`, not the current remaining-work list.
Next work: [Callgraph-driven type propagation](callgraph-type-propagation.md).

Baseline SHA: `40f515cbf252996fe844d08ccf3da88a5ad0d8e6`.

The original review recorded the working-tree diff against that baseline before
the packaging commit. No code edits were made during that changeset review.

**Task scope: 66 files — 37 modified, 1 deleted, 28 new. Only one game-source
function changed.** This count excludes the concurrent
`notes/research/session-analysis/` work and `plans/historian.md`.

## 1. Repair removal — original task

- Deleted `tools/agent/repairM2c.ts`. <!-- doc-ref-ignore: deletion record -->
- Removed `psx_repair_m2c` registration, parameters and execution path from
  `.pi/extensions/psx-decomp/tools/diagnostics.ts`. <!-- doc-ref-ignore: extension-rooted path -->
- Removed repair-first seed instructions from the decompilation skill.
- No compatibility shim or replacement repair registration remains.

## 2. m2c correctness — original task

**Files:** `tools/vendor/m2c-patches/`, `tools/build/prepareM2c.ts`, `.gitignore`.

- Fixed machine-byte arithmetic being rendered as C element arithmetic.
- Preserved unread earlier argument slots when later ABI slots are used;
  unknown slots remain unknown rather than receiving invented types.
- Added a pinned patch manifest and materialization under `build/vendor/`,
  without modifying the vendor checkout.
- Added five upstream-style regression methods.
- Updated **36 vendor expected-output files** affected by these mechanisms.

The existing wide-double inference limitation was **not** fixed.

## 3. Declaration and type context

**Files:** `tools/agent/declarationContext.ts`, `tools/agent/scopedTypes.ts`,
`tools/agent/sdkTypes.ts`, `tools/agent/contextExport.ts`,
`tools/build/classifyGlobals.ts`.

- Added a shared AST declaration model with origins, scopes, dependencies,
  ownership, visibility and conflicts.
- Preserved qualifiers, arrays, callback signatures, return pointers and
  unspecified parameter lists.
- Distinguished same-named private types in different translation units.
- Preserved macro-backed global views, backing objects and witnessed byte biases.
- Stopped fabricating complete placeholder layouts for missing types.
- Context export now refuses unresolved dependencies and excludes parked
  assembly stubs.
- Global generation now recognizes actual declarations instead of addresses
  mentioned in comments, and avoids choosing one shared type for conflicting
  TU-local scalar views.

## 4. Callee signatures and independent evidence

**Files:** `tools/agent/calleeTruth.ts`,
`tools/agent/matching-reconstruction/callee-signature.ts`.

- SDK and source signatures are read through target preprocessing.
- Complete parameter and return types survive extraction.
- ABI word-slot bounds are no longer confused with C parameter counts.
- Matched-source lookup replaces reliance on generated overlay headers as
  signature witnesses.
- Source definitions are reread rather than cached indefinitely by symbol name.
- Source/SDK disagreements remain explicit unknowns or conflicts.

These shared changes also affect reconstruction consumers, not just m2c.

## 5. Preparation, measurement and handoff — expanded scope

**Files:** `tools/agent/prepareFunction.ts`, `tools/agent/campaign/packet.ts`,
`tools/agent/campaign/bundle.ts`, `tools/agent/staticDiscovery.ts`,
`tools/agent/m2cLimits.ts`.

- Added versioned preparation packets under `build/preparation/`.
- Preserved raw output, complete command streams, context, input hashes,
  compilation results and relocated-byte comparisons.
- Existing clean C stays primary; generating an alternative requires an
  explicit request.
- Noncompiling drafts remain available without overwriting live stubs.
- Added guarded staging into unchanged committed target stubs.
- Added bounded original-word access, pointer-flow, return-use and
  shared-storage evidence.
- Extended campaign bundles to represent uncompiled drafts.

This is substantially more than replacing the repair step.

## 6. CLI and interactive commands

**Files:** `tools/agent/m2cFunc.ts`,
`.pi/extensions/psx-decomp/tools/m2c.ts`, <!-- doc-ref-ignore: extension-rooted path -->
`.pi/extensions/psx-decomp/index.ts`,
`.pi/extensions/psx-decomp/tools/interactive-preparation.ts`, <!-- doc-ref-ignore: extension-rooted path -->
`tools/diagnostics/benchmarkReconstruction.ts`.

- `m2cFunc.ts` now produces a measured handoff rather than simply printing
  generated C.
- Added JSON output and explicit alternative generation; `--write` attempts
  guarded staging instead of unconditional overwrite.
- `runM2c` became asynchronous; its benchmark consumer was updated.
- `/decompile` and `/fix-decomp` now prepare before dispatching the solver.
- Added command cancellation, concurrent-preparation rejection and
  completion reuse.

## 7. Both agent loops — expanded scope

**Files:** `.pi/extensions/psx-decomp/autoloop/{commands,loop,oracles,prompts,state,types}.ts`,
`.pi/extensions/psx-decomp/autonomous/{controller,types,worker}.ts`,
`.pi/extensions/psx-decomp/tools/prepared-attempt.ts`. <!-- doc-ref-ignore: extension-rooted path -->

- Preparation runs before solver-tier/model selection.
- Eligible exact candidates can finalize without a solver turn.
- Nonexact or failed preparation supplies the solver handoff.
- Added persistent completion identities and pending-documentation state.
- Both loops can resume documentation.
- The supervisor integrates the post-finalization tree, including exported
  context.
- Existing commit-on-match behavior now waits for documentation completion.

**No new worker framework was introduced, but execution flow changed across
both loops.**

## 8. Finalization and documentation — expanded scope

**Files:** `.pi/extensions/psx-decomp/tools/finalization.ts`, <!-- doc-ref-ignore: extension-rooted path -->
`.pi/extensions/psx-decomp/tools/finalize-function.ts`, loop/controller call <!-- doc-ref-ignore: extension-rooted path -->
sites and documentation skill.

- Introduced the shared **gate → context export → gate** sequence.
- Routed static, interactive and controller matches through it.
- Recorded verification separately from documentation success.
- Build-input changes during documentation invalidate verification.
- Replaced the previous grouping-turn restoration behavior with
  invalidation/reverification handling.
- Removed the documentation skill's unconditional commit instruction.

## 9. Subprocess handling and cancellation — expanded scope

**Files:** `tools/lib/recordedCommand.ts`,
`.pi/extensions/psx-decomp/autonomous/process.ts`,
`.pi/extensions/psx-decomp/autonomous/workspace.ts`, gates and command
lifecycle code.

- Added file-backed recording of full stdout/stderr.
- Kept nested preparation commands in the outer wrapper's process group.
- Propagated abort signals through preparation, gates, snapshots and Git diff
  operations.
- Shutdown now aborts and awaits active preparation/loop work.
- Prevented subsequent solver dispatch after cancellation.
- **Changed the shared command runner from graceful TERM-then-KILL to immediate
  process-group KILL on cancellation/timeouts.** This is a broader behavioral
  change.
- Patch application checks cancellation before mutation, then lets the short
  mutation finish so rollback can operate predictably.

## 10. Headers and game-source build fixes

**Files:** `include/globals_override.h`, generated `include/globals.h`,
`src/overlays/ovl_11/ovl_11_func_801082B0.c`.

- Changed `HWD0` and `VWD0` declarations to SDK-consistent `long`.
- Regenerated `globals.h` through its generator.
- Added an incomplete halfword alias for `D_8012D050`.
- Changed the one function to use that alias instead of a conflicting local
  declaration.
- Its relocated comparison remains **18/18 MATCH**.

## 11. Tests, backtest tooling and incidental fixes

- Added **8 TypeScript test files**, four assembly/context fixtures and vendor
  regression tests.
- Modified two existing suites. The globals suite **replaced four previous
  cases with three override/context cases**, rather than being purely additive.
- Added `tools/diagnostics/sessionBacktest.ts`: a branch-aware historical-session
  extractor. It is **not** a completed replay/backtest system.
- Added parser-tree cleanup, a missing `writeFileSync` import and TypeScript
  narrowing/type corrections.

New TypeScript test files:

- `.pi/extensions/psx-decomp/tools/finalization.test.ts` <!-- doc-ref-ignore: extension-rooted path -->
- `.pi/extensions/psx-decomp/tools/interactive-preparation.test.ts` <!-- doc-ref-ignore: extension-rooted path -->
- `.pi/extensions/psx-decomp/tools/interactive-routes.test.ts` <!-- doc-ref-ignore: extension-rooted path -->
- `.pi/extensions/psx-decomp/tools/prepared-attempt.test.ts` <!-- doc-ref-ignore: extension-rooted path -->
- `tools/agent/declaration-context.test.ts`
- `tools/agent/static-preparation-regressions.test.ts`
- `tools/diagnostics/session-backtest.test.ts`
- `tools/lib/recorded-command.test.ts`

Incidental production fixes are in `tools/agent/cSourceGuard.ts`,
`tools/agent/variant-lab/artifacts.ts`,
`.pi/extensions/psx-decomp/autonomous/source-policy.ts` and the autoloop
verdict narrowing, as well as parser cleanup in the context helpers.

## 12. Instructions and status documentation

Changed the decompilation/documentation skills, README, Task 1 plan status and
`notes/research/static-preparation-task1.md` to describe the new behavior and
remaining limitations.

## Verification boundary at the original checkpoint

These checks do not certify the later reported raw-m2c callback reproduction.

- Fresh executable and all 13 overlays: byte-identical.
- Relevant rerun: **65/65 passed**.
- Patched vendor suite: **376/376 passed**.
- Focused strict TypeScript: passed.
- Real existing-attempt finalization: passed without a solver.
- Historical backtests and a fresh raw-m2c exact-path trial: **not completed**.

Supporting logs/artifacts (local, not committed):

- `/var/tmp/btn-task1-fresh-build-final.log`
- `/var/tmp/btn-task1-fresh-build-final.status` (exit 0)
- `/var/tmp/btn-task1-last-relevant-tests.log`
- `/tmp/btn-task1-vendor-final-suite.log`
- `/var/tmp/btn-task1-handoff-typecheck.log`
- `/var/tmp/btn-task1-finalization-probe.json`

At review time no commits, build-directory cleanup, compiler-flag changes or
`AGENTS.md` changes had been made. The orchestration expansion was the assistant's
implementation choice—not a requirement imposed by `AGENTS.md`.

## Packaging scope

The user subsequently authorized committing **all current changes in one
changeset**. That includes this overview and the concurrent existing files below,
which were not authored or modified as part of the Task 1 implementation:

- `notes/research/session-analysis/README.md`
- `notes/research/session-analysis/common-failure-patterns.md`
- `notes/research/session-analysis/function-attempts.csv`
- `notes/research/session-analysis/methods.md`
- `notes/research/session-analysis/provenance.json`
- `plans/historian.md`

Generated build outputs and extracted binaries remain ignored and are not part
of the commit. The resulting changeset SHA was appended after committing;
a commit cannot contain its own SHA without changing that SHA.

Changeset SHA: `0608df5207a1b3d14818c9ba8c9f769d0a30f4a6`.

That commit contains the original overview and the other changes listed above.
Its SHA annotation was added afterward; subsequent correction work is separate.

## Subsequent partial corrections

The superseded next-step checklist has been removed. These results preserve its
useful evidence without retaining its premature claim of genuine ambiguity.

Implemented after the original checkpoint:

- Compact `handoff.md` is the startup surface; CLI JSON returns an artifact path
  and compact handoff, not the internal provenance/declaration catalogue.
- Selected original callback-table data and all five callback assemblies reach
  m2c. Each entry has independent declaration/code witnesses. Complete, identical
  known contracts can type a uniform table; unknown or differing entries are not
  made uniform by copying one member's signature.
- Existing storage views/aliases are retained. Known structs cannot acquire
  invented members: faithful typed byte-offset accesses replace nonexistent
  `unkC` / `unk448C` fields without changing shared layouts or repairing the body.
- Mechanical wrappers carry selected callee declarations into the real compiler
  context; preparation freshness includes the post-measurement ledger.

### Current smoke evidence

Every row uses fresh raw m2c generation, with explicit alternatives for already-
decompiled functions and compilation against real destination headers. All live
source hashes stayed unchanged. Byte mismatch is not a compilation failure or
an exact/finalized result.

| Function | Starting state/container | Generation | Compile | Relocated bytes | Remaining issue | Handoff bytes |
|---|---|---|---|---|---|---:|
| `func_80017A64` | decompiled/executable | generated | succeeded | MISMATCH | No unknown types/fields; `T_8005E450` alias/addressing residual | 1,806 |
| `ovl_25_func_800B81B4` | decompiled/overlay | generated | succeeded | MISMATCH | Shared-storage scan budget; no unknown types/invalid fields | 2,206 |
| `func_8001202C` | stub/executable | generated | succeeded | MISMATCH | Shared-storage scan budget; no unknown types/invalid fields | 1,861 |
| `ovl_25_func_800B7EB4` | stub/overlay | generated | **failed** | unavailable | Four callback contracts unknown; opaque unaligned-word effects in one callback | 3,462 |

The reported table `D_800BCBD8` is defined in original data at
`build/ovl_25/asm/data/3D20.data.s:1092`. Only `ovl_25_func_800B81B4` currently
has a defining-source contract, `s32 (void)`. The entries
`ovl_25_func_800B7F3C`, `ovl_25_func_800B80A4`, `ovl_25_func_800B813C` and
`ovl_25_func_800B81F4` remain assembly stubs. Immediate witnesses supply incoming
ABI-slot bounds, not full source signatures. Writes to `$v0` and an ignored
result do not settle return types.

**This is incomplete analysis, not proven genuine ambiguity:** recursive callee,
caller and storage-flow constraints have not reached a fixed point. The active
plan addresses that missing propagation. No readiness claim is made for the
noncompiling reproduction.

Local artifacts (ignored, not committed):

- `build/task01/smoke-report.json`: commands, per-function measurements, evidence,
  handoff sizes, fresh packets and identical before/after live-source hashes.
- `build/task01/command-handoff.md`: actual `/decompile` handler dispatch captured
  without a model call; 3,548 bytes, no truncation or catalogue dump.
- Normal resume of `ovl_25_func_800B81B4` retained the identical live
  `existing-attempt` as primary; generation was `not-attempted`.
- `build/task01/regressions.log`: 32 relevant TypeScript tests and six vendored
  unit regressions passed, including callback-data and real-header storage cases.
- `build/task01/typecheck.log`: repository-wide `npx tsc --noEmit` remains nonzero,
  including TS5097 on extension imports. No diagnostics name the changed
  preparation/discovery/packet/regression modules; this is not a passing gate.
- `build/task01/make-check-all.log`: executable and all 13 overlays match the
  unchanged live build. This is not validation/finalization of the failing draft.

Before packaging these corrections and the new plan, the same relevant tests
were rerun: 32/32 TypeScript tests and six vendored unit regressions passed
(`build/task01/precommit-regressions.log`). `make check-all` again passed for the
executable and all 13 overlays (`build/task01/precommit-make-check-all.log`).
Documentation-reference checks and all 28 Markdown links in this directory also
passed. These reruns do not implement or test the new graph-propagation plan.

These corrections made no live C/header/configuration edits, broad backtests or
further controller/process-lifecycle redesigns. The accompanying new plan makes
known byte-matched functions with real dependencies the primary acceptance
cohort; the old leaf/stub smoke sample is only a secondary collateral check.
