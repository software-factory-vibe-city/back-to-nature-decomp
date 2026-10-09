# Plan: callee-signature and m2c-context integrity

**Status: implemented 2026-10-08.** It follows commit `383a33b6`, which fixed
the instance by hand. Phases 1–4 and adjacent cleanup are complete.

## Implementation results

- Callee truth exposes per-slot reads, distinguishes unread from undetermined
  parameters, and reports passed unread arguments as material. Triage pushes
  them as actionable signals. Incomplete targets, unresolved forwarding,
  recursion and unknown ABI layouts cannot prove unreadness.
- Prep truncates only confirmed unused trailing parameters, preserves interior
  slots, and records undetermined arity instead of silently inferring it.
- The exporter reports disagreeing local prototypes without vetoing publication,
  enforces compiler independence of generated context, and retains other
  containers' shared types. Finalization records the machine-readable publication
  outcome and fails a missing outcome or stale skipped publication.
- The full definition-and-caller census covered **1,649 matched definitions**:
  29 unread-tail definitions and 36 material caller findings. Byte-verified
  callee and matched-caller probes removed **71 parameters from 27 definitions**.
  Five definitions retain unread parameters because matched caller bytes require
  them. The post-change definition census confirms exactly those five, with no
  unavailable or nonmatching definitions. The complete table and evidence paths
  are in `notes/research/tooling-false-verdicts.md` §5.
- Generated headers were republished, changing 28 signatures: the 27 audited
  corrections plus the already-corrected `ovl_11_func_800F5888` (3 → 2).
  `sdk_types.h` is unchanged. Single-function and ovl_11-scoped exports both
  pass their self-checks.
- All 31 measured live definitions/callers are `EXACT`. **`npm test`: 1,245
  passing tests. `make check-all`: EXE and all 13 overlays byte-identical.**
  The old three-argument acceptance source reports material `unread-argument`
  with reads `[0, 1]`, and actual triage emits the corresponding signal.
- The source-policy scan reports zero newly added forbidden constructs. Its
  repository-wide gate is not green: 31 findings are in unchanged HEAD files,
  and its single-function worker scope rejects the explicitly requested tooling
  edits. No policy allowlists were weakened.
- Removed the 19 empty cc1 dumps and ignored `src/**/*.c.*`.

## Purpose

A wrong callee arity, once it enters the project, is currently self-sustaining:

- m2c invents it;
- prep lets m2c invent it;
- callee truth certifies it;
- the context exporter cannot retract it.

Every caller drafted afterwards inherits it. An extra argument changes the
caller's machine code, so the residual it causes looks like a scheduling or
allocation problem that no spelling can fix. The goal is that an argument the
callee never reads is **visible, reported as material, and not re-propagated**.

---

## The failure this comes from

`ovl_11_func_800F5888` takes two arguments. Its incoming `$a2` is overwritten
before any read. The implemented same-block caller scan reports **1 of 12**
target sites setting `$a2`, not the originally proposed zero: `800E48CC` has an
early scratch copy from `$a0`. This heuristic is not an argument-use witness.
m2c drafted a third parameter because `$a2` was live at a call site.

| Date | Function | Effect of the phantom argument |
|---|---|---|
| 2026-10-06 | `ovl_11_func_800E48CC` | a call-argument copy that local-alloc could not coalesce; fixed per-caller only |
| 2026-10-08 | `ovl_11_func_801213D8` | `$a2` set twice, so sched1's birthing boost was lost on the later `$a2` copy; 23 ledger attempts, none could match |

Each stage of the pipeline either produced or protected the wrong arity:

1. **The callee's matched definition kept the phantom parameter.** Nobody
   reads it, and it compiles byte-identically either way.
2. **Prep invited m2c to re-invent it.** `prepareFunction.ts:342` projects a
   callee whose definition has any unused parameter as an unspecified `()`
   declaration. m2c then infers the arity from register liveness at the call
   site, which is how the phantom was created in the first place.
3. **Callee truth certified it.** `calleeTruth.ts` compares the declaration
   in scope with the definition's *declared* parameter count. It uses the
   callee's target code only as a floor (`minimumArity`/`maximumArity`,
   `frameMap.ts:650-667`). The three-argument call matched the
   three-parameter definition, so it was **corroborated**: two copies of one
   m2c guess agreeing.
4. **Callee truth's advice was wrong.** Once the definition was corrected,
   the old call became **disputed**, with the advice "costs nothing… leaves
   no trace in either function's machine code" (`calleeTruth.ts:755`). That
   holds for the callee, never for the caller, which writes an argument
   register it would not otherwise write.
5. **The exporter cannot publish the correction.** `contextExport.ts:305-321`
   refuses to publish any function another `.c` file declares, even
   identically. The finalize step (`finalization.ts:47`) treats that skip,
   which exits 0, as success. `include/overlays/ovl_11.h` therefore still
   declares three parameters.
6. **The container-scoped regeneration is broken.** `--container X --all`
   resolves the shared `include/sdk_types.h` over one container's signatures,
   dropping types only other containers use. Its own m2c self-check fails on
   `void ClearPairS32(PairS32 *obj);` and it restores the old files. Only
   plain `--all`, run by `make split`, works.

Details are in `notes/research/tooling-false-verdicts.md` §5–§6 and
`notes/research/ovl_11_func_801213D8-phantom-callee-argument.md`.

---

## Design principle

- **A parameter is witnessed only by code that reads it**, or by an
  authoritative SDK header. A reconstruction (`src/` definition, local
  prototype, generated header) cannot vouch for a parameter its own compiled
  code never touches. This applies the rule `calleeTruth.ts` already follows
  for `functions.h` ("a derived artifact cannot corroborate the thing it was
  derived from") to unread parameters.
- **Materiality is judged at the call site, not the interface.** An unread
  parameter is free for the callee and never free for a caller that passes a
  value there.
- **A generator never fails silently.** A skipped publication is a reported
  outcome, not a success.

---

## Phase 1 — callee truth: per-parameter witnesses

**Files:** `tools/agent/calleeTruth.ts`, `tools/agent/frameMap.ts` (read
only), `tools/agent/callee-truth.test.ts`.

1. **Expose the read set.** Add `reads: number[]` to the target witness: the
   incoming argument positions the callee actually reads, stack and register.
   `analyzeFrame` already computes `registerParameters` and `incoming`;
   surface them instead of collapsing them into `minimumArity`.
2. **Adjudicate per parameter.** For each declared parameter at position
   `i`:
   - **witnessed** if the target reads `i`, if `i` lies below a read position
     (it must exist), or if an SDK header declares it;
   - **unread** otherwise.

   A matched definition or local prototype never moves a parameter out of
   `unread`.
3. **Add a new status, `unread-argument`, ranked above `disputed`.** It
   applies when the call sites in the translation unit under audit pass an
   argument at an unread position. Report it as material: "this call writes
   `$aN` (or a stack slot) that the callee never reads; the original call
   site may not have". When no call site passes it, report it as hygiene,
   with no status change.
4. **Fix the `disputed` advice.** It should say that an arity disagreement
   is free in the callee but costs the caller whenever the caller passes the
   extra argument.
5. **Caller-site evidence (heuristic, reported, never proof).**
   - Count the callee's target call sites, across all containers, that write
     `$aN` in the call's block before the `jal` (delay slot included).
   - Report the observed count next to the read set (this target gives
     "1 of 12 call sites set `$a2`"; see the correction above).
   - The caveat goes into the message: a value can already be in the
     register, as in `800E48CC`'s entry `addu a2,a0`.
6. **Tests.** Use a fixture shaped like this case:
   - a callee reads `$a0`/`$a1`;
   - its definition declares three parameters;
   - a caller passes three.

   Assert `unread-argument`, material, and not `corroborated`. The same
   fixture with the caller passing two asserts `corroborated` plus a hygiene
   note on the definition. Update the existing 13 tests where their status
   expectations change.

**Downstream for free:** triage's `callee-truth` detector
(`triage.ts:1457`, `:1480`) consumes `auditCallees`. The new status needs a
severity mapping there so it is pushed as actionable, and a triage test.

## Phase 2 — prep stops inviting m2c to invent arity

**Files:** `tools/agent/prepareFunction.ts`,
`tools/agent/type-propagation/c-types.ts`, plus prep tests.

1. **Truncate instead of blanking.** Replace the `()` projection at
   `prepareFunction.ts:342`. When the callee's definition has unused
   *trailing* parameters and the target read set (Phase 1) confirms they are
   unread, project a prototype truncated to the last witnessed parameter. An
   unused *interior* parameter stays, because a later read proves its slot
   exists.
2. **Keep `()` only where the arity is undetermined:** no target witness, or
   the read set and the definition disagree in a way truncation cannot
   resolve. Record a discovery unknown naming the reason, so the draft's
   arity is never an unmarked m2c inference.
3. **Tests.** Add a prep fixture over `ovl_11_func_800F5888`'s shape: the
   projected declaration is `s32 ovl_11_func_800F5888(u16 *, s32 *);` and the
   m2c draft's call passes two arguments.

## Phase 3 — the context exporter publishes corrections

**Files:** `tools/agent/contextExport.ts`, `tools/agent/contextExport.test.ts`,
and `finalization.ts` in `.pi/extensions/psx-decomp/tools/`.

1. **Remove the local-prototype guard** (`contextExport.ts:305-321`).
   - The generated headers are m2c context only, as the module header says.
     Add a test that fails if any `src/` file or non-generated header
     `#include`s `functions.h` or `include/overlays/*.h`, so the claim is
     enforced rather than assumed.
   - Replace the guard with a **report**: list the local prototypes that
     disagree with the definition being published. Those are the next callee
     truth findings.
2. **Fix `--container X --all`.** In `exportAll`, resolve types over
   `unionSignatures(rootDir, container, current)`, the same function the
   per-function path already uses, so the shared `sdk_types.h` keeps every
   other container's types. Add a regression test: a container-scoped export
   whose own signatures do not name a type another container's header uses
   must still pass the self-check.
3. **Make skips visible.**
   - `exportContext` already returns `{ skipped, reason }`. The CLI must exit
     non-zero for any skip other than "no function definitions (stub?)", or
     print a machine-readable status line.
   - `finalization.ts:47` records the outcome in the finalize result. A
     skipped publication fails finalization when the function's signature in
     the generated header differs from its definition.
4. **One-time republication.** After 1–3, run `contextExport --all`. Review
   the diff of `include/functions.h`, `include/overlays/*.h` and
   `include/sdk_types.h`. Expect `ovl_11_func_800F5888` to drop to two
   parameters, and list every other changed signature in the implementation
   record (and any separately authorized commit message): each was stale.

## Phase 4 — audit for other phantom parameters

**Depends on:** Phase 1 (read sets) and Phase 3 (publication).

1. **Census.** Add a `calleeTruth.ts --audit-definitions` mode. For every
   matched definition, compare declared parameters with the target read set
   and list trailing unread parameters. Separately, run callee truth over
   every matched caller and list `unread-argument` findings.
2. **For each unread trailing parameter:**
   - drop it from the definition;
   - confirm the callee is still EXACT (`residualObjective`);
   - check whether any matched caller's bytes depend on passing it. A caller
     that matches *only* with the extra argument is evidence the parameter is
     real. Record it and keep the parameter.
3. **Republish, gate, and record.** Republish through the fixed exporter,
   run `make check-all`, and record the table in
   `notes/research/tooling-false-verdicts.md` §5.

## Adjacent cleanup

Commit `3c90492d` checked 19 empty cc1 dump files into `src/overlays/ovl_11/`
(`ovl_11_func_80121204.c.{rtl,cse,…}`).

- Remove them.
- Make the source-policy guard reject non-`.c` files under `src/`, or add
  `src/**/*.c.*` to `.gitignore`, whichever the policy owner prefers.

This change is independent of everything above.

---

## Sequencing

| Order | Work | Depends on |
|---|---|---|
| 1 | Phase 1 (callee truth) | — |
| 2 | Phase 3 (exporter) | — |
| 3 | Phase 2 (prep) | Phase 1's read-set API |
| 4 | Phase 4 (audit) | Phases 1 and 3 |
| 5 | Adjacent cleanup | independent |

Phases 1 and 3 are independent and can be built in parallel.

## Acceptance criteria

- **Callee truth.** Run against `build/experimentLedger/sources/
  ovl_11_func_801213D8/b0be22f71f478ab3.c` (the previous session's
  three-argument source), it reports `ovl_11_func_800F5888` as
  `unread-argument`, material, with the read set and caller-site counts. A
  fixture with the definition reverted to three parameters gives the same
  result.
- **Triage** pushes that finding as actionable.
- **Prep** for a function calling `ovl_11_func_800F5888` projects the
  two-parameter prototype, not `()`.
- **Exporter.**
  - `contextExport ovl_11_func_800F5888` publishes the two-parameter
    signature;
  - `contextExport --container ovl_11 --all` passes its self-check;
  - a skipped publication is visible in the finalize result.
- **Header.** `include/overlays/ovl_11.h` declares
  `s32 ovl_11_func_800F5888(u16 *arg0, s32 *arg1);`.
- **Gates.** `npm test` and `make check-all` pass.

## Out of scope

- **Parameter types beyond arity.** Narrowing and signedness are a separate
  question, partly answered by `frameMap`'s `registerTypes`.
- **Return-type adjudication**, which callee truth already handles.
- **Any change to maspsx.** It is upstream with no local patches.
