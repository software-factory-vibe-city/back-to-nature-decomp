# Task 1: implementation ready for user testing

There is no source-repair stage or active repair tool registration. Preparation
is enabled for `/decompile`, `/fix-decomp` and both existing controllers.
Existing clean C remains primary; raw m2c output, full diagnostics and measured
packets are preserved under `build/preparation/`. Noncompiling drafts do not
replace live stubs. Declaration publication beyond existing context export
(Task 2) is not implemented.

## Delivered

- Shared target-preprocessed declaration context, scoped type dependencies and
  explicit unknowns/conflicts; bounded original-word access and call evidence.
- Reproducible patches to pinned m2c for typed-pointer byte arithmetic and unused
  earlier ABI slots. Faithful context alone cannot correct these emitter defects.
  Patches materialize under `build/vendor/`; the vendor checkout is unchanged.
- Guarded staging and the common gate → context export → gate finalization
  route. Completion identities distinguish verification from pending
  documentation; documentation does not authorize commits.
- Cancellation propagated through preparation and finalization. The measured
  outer-wrapper/nested-process-group orphan case is fixed and checked using the
  actual `npx tsx` wrapper and a live child compiler. This is not an exhaustive
  cross-platform process-lifecycle guarantee.

## Verification completed

- Fresh forced rebuild of every game C source in a disposable integration
  workspace: executable and all **13 overlays byte-identical**. The repository's
  existing `build/` was not cleaned or deleted. Log:
  `/var/tmp/btn-task1-fresh-build-final.log` (status file: exit 0).
- Full project test run: **1,045/1,049 passed**; four failed from disk exhaustion.
  After disk space was restored, all four plus the relevant suites passed:
  **65/65**, `/var/tmp/btn-task1-last-relevant-tests.log`.
  A new full-suite green run is not claimed.
- Patched m2c suite: **376/376 passed**, including audited expected-output
  updates; pristine upstream: **371/371 passed**.
  `/tmp/btn-task1-vendor-final-suite.log`.
- Focused strict TypeScript check passed for preparation, discovery, vendor
  materialization and extension/controller entrypoints. Repository-wide
  TypeScript cleanliness is not claimed.
- Real preparation: `ClearVal8005E2D4` existing attempt compiled exactly;
  `func_8002206C` preserved a noncompiling raw m2c draft and useful diagnostics
  without modifying the stub. Actual static finalization of the existing exact
  attempt passed both real gates without a solver, with documentation pending:
  `/var/tmp/btn-task1-finalization-probe.json`. This was not a raw-m2c exact trial.

Fresh-build header conflicts required SDK-consistent `long` declarations for
`HWD0`/`VWD0`, suppression of an ambiguous shared scalar extern by the generator,
and an incomplete halfword alias for `D_8012D050`. The only game-source edit uses
that alias in `ovl_11_func_801082B0`; its relocated oracle remains **18/18 MATCH**.
`include/globals.h` was regenerated, not hand-edited.

## Try it

Reload the extension, then use `/decompile <function>` or
`/fix-decomp <function>`. Cancel with `/decompile --cancel` or
`/fix-decomp --cancel`. Preparation alone, without a solver or live staging:

```sh
npx tsx tools/agent/m2cFunc.ts <function> --json
```

## Deferred / limitations

Historical and controlled session backtests have **not** been run; no token,
time or solved-outcome improvement is claimed. Full static type recovery,
unsupported dynamic flows, ambiguous layouts and the old wide-double ABI
inference limitation remain explicit handoff work. The multi-function m2c probe
is not adopted as an authoritative single-function seed. No new tests or
backtest infrastructure work is required before user testing.

No commits were made. Concurrent session-analysis notes and `plans/historian.md`
were left untouched.
