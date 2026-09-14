# Second static-first review: gains, remaining safety gaps, and recalibration

Independent re-review of [the response](static-first-review-response.md) to
[the first review](static-first-implementation-review.md). Evidence and scripts
are under `build/static-first-rereview/`. The first-review implementation was
preserved in its disposable tree; the response implementation is the current
uncommitted working tree. No production implementation, game source, headers,
configuration, or flags were changed by this review.

**Verdict: substantially more acceptable C, and a genuinely working donor
feedback mechanism. However, long-running context collection and the final
integration gate are still unsafe. The response's blanket closure claims are
too strong.** CFG-to-C construction, executable recipe repair, and measured
agent-effort savings remain outstanding, as the response acknowledges.

## 1. Corrected, controlled measurement

The first rerun exposed persistent parser failures, so merely repeating the old
runner was not a sound final comparison. Long-lived workers returned 63 warm
engine matches and 65 cold matches, but their stderr contained `Aborted()` and
their signature evidence had degraded. Section 3 explains why.

For the final comparison I retained the frozen **1,852 stubs / 570,308 bytes**,
**64-candidate cap**, production flags, unchanged live source context, and
60-second per-function timeout. Workers were restarted every **10 functions**.
The previous implementation was run serially and in private-root serial shards
to avoid its independently confirmed shared-target-file race. Neither corrected
run reported parser aborts or function timeouts. No recovered-overlay entries
were available to these construction-only runs.

Only **1,789 functions / 554,252 bytes** in this cohort count toward live progress.
It remains a backlog sample, not an untouched-game yield estimate.

| Measurement | Previous implementation, rerun | Response implementation |
|---|---:|---:|
| Warm engine byte-exact candidates | 41 / 2,976 bytes | 62 / 4,232 bytes |
| Above, without rejecting compiler diagnostics | 25 / 1,920 bytes | 62 / 4,232 bytes |
| Nonexact compiling drafts | 357 / 55,852 bytes | 611 / 97,268 bytes |
| Drafts without rejecting compiler diagnostics | 275 / 44,124 bytes | 611 / 97,268 bytes |
| Functions reaching compiled comparison | 398 | 673 |
| `unsupported-target` outcomes | 1,407 | 1,055 |

The previous numbers differ from the first review's 47 matches / 556 drafts
because its long-lived workers also exhausted the parser. Losing authoritative
types sometimes *opens* a constructor domain; those inflated draft counts were
not evidence of better warm-context reconstruction. Use the controlled comparison
above for this change, not the old table as though nothing affected measurement.

The same **12 existing-donor transfers / 780 bytes** still match. Four now overlap
with engine wins, leaving **eight additional functions / 620 bytes**.

Combined warm construction and existing-donor replay:

- Previous raw pool: **53 / 3,756 bytes**; new raw pool: **70 / 4,852 bytes**.
- Previous pool after the new diagnostic rejection rules: **37 / 2,700 bytes**.
- New pool: **70 / 4,852 bytes**, independently recompiled, parsed, published
  through the new source/byte gate, and free of rejecting compiler diagnostics.
- **All 37 previously diagnostic-acceptable candidates survive.** The eight lost
  raw winners had rejecting diagnostics; 25 new raw winners give a net raw gain
  of 17. The diagnostic-acceptable pool improves by **33 / 2,152 bytes**.
- **65 / 4,516 bytes** of the new combined pool are live-eligible.

These are verified candidate artifacts, not 70 fully integrated functions. The
raw combined pool is still only **3.78% of remaining stubs and 0.85% of their
bytes**. The improvement is real and still concentrated in small functions.

### Cold and held-out results

With the same parser containment, current cold construction finds **72 exact
candidates / 5,384 bytes**, plus 623 nonexact drafts. This is configured-project
cold mode, not a bootstrap experiment. Warm has stronger declarations that the
constructor still cannot always express; a higher cold count does not mean those
declarations should be discarded.

The 99-function held-out warm test improves from **26 exact / 496 bytes** to
**27 / 536 bytes**, with 24 nonexact drafts. That is one additional 40-byte match,
not a broad new large-function capability.

## 2. Actual integration experiment

All 70 corrected warm/family sources passed independent production compilation
and relocated-byte comparison. Each was also published to a private artifact
overlay. The actual integration planner then returned:

- **62 `would-apply`**;
- **8 refused**;
- but **four of the would-apply plans chose historical invalid C**, despite a
  corrected, independently verified source being available in the overlay.

After rejecting those four plans, I staged **58 functions / 3,996 bytes** in a
new disposable project copy. **54 functions / 3,720 bytes** count toward live
progress. All 13 overlay containers and the PS-X EXE remained byte-identical.

The resulting sandbox progress is:

| | Live tree | This sandbox |
|---|---:|---:|
| Functions | 770 / 2,559 — 30.09% | 824 / 2,559 — 32.20% |
| Bytes | 90,920 / 645,172 — 14.09% | 94,640 / 645,172 — 14.67% |

Compared with the first review's sandbox, this is **24 more live functions /
1,580 more bytes**. Compared with the untouched live tree, it is **+2.11
percentage points of functions and +0.58 points of bytes**.

This is an incremental sandbox build, using existing objects for unchanged
functions, not a claim to have fixed the previously documented clean-rebuild
problem. Context export still emits guessed opaque layouts—including a newly
stamped `Recon800CD08CA0View`. Shared type/layout publication remains unfinished.
**No live candidate integration was performed.**

## 3. High-priority findings

### P1 — parser exhaustion still silently changes the evidence

The target-file race was real and its fix works in a genuinely concurrent probe:

- Previous implementation: four concurrent processes, 20 witnesses each,
  yielded 50 correct `SquareRoot0` arities and 30 missing witnesses.
- Current implementation: **80/80 identical correct arities**.

However, this was not the sole cause of the two inconsistent reconstructions.
`tools/agent/calleeTruth.ts` reparses all SDK headers in `sdkPrototypes()`;
`prototypesIn()` never deletes its temporary tree. The WASM syntax trees are not
released just because their JavaScript wrappers become unreachable.

A single-process test, with **no target assembly or concurrent workers**, fails
on SDK lookup iteration 316:

- the SDK prototype index drops from **1,838 entries to eight**;
- RSS reaches about **2.43 GB**;
- parsing a trivial C function then throws `RuntimeError: Aborted()`;
- `prototypesIn()` catches parser failure and returns an empty list, which the
  caller reads as absence of declarations rather than failed analysis.

A review-only control deleting each call's 61 temporary SDK trees completes
**700 iterations**, retaining all 1,838 prototypes and `SquareRoot0`, with RSS
stabilized around **352 MB**. This intervention was not applied to production.

The actual census repeats the earlier contradictions even with atomic target
files: `ovl_23_func_800BA30C` fails after losing its SDK return declaration but
matches in a fresh process; `ovl_27_func_800BA578` matches after losing typed
`ReadFlag` parameters but is refused with them present. The recycled-worker run
restores consistent evidence.

**Required:** correct tree ownership/lifetimes, cache immutable SDK facts, and
fail closed on parser/resource errors. An unavailable declaration and an analyzer
that failed to read an available declaration are different states. Recycling is
an evaluation containment, not the production fix.

The new test named “concurrent processes witness the same callee identically”
uses `.map(() => spawnSync(...))`, so it runs its processes serially. It needs
actual concurrent children to hold the race fix. The independent race probe in
this review does use concurrent processes.

### P1 — integration can still accept invalid C from old results

`tools/agent/campaign/integration.ts` prefers an engine result over the freshly
published overlay, calls `loadResult()` without freshness inputs, and does not
check compiler diagnostics in `stageAndVerify()` or `verifyInTree()`.

Consequently these real plans select historical valued returns in `void`
functions and still report `would-apply`:

- `ovl_11_func_800FAAD4`;
- `ovl_11_func_800FBE4C`;
- `ovl_17_func_800BB020`;
- `ovl_19_func_800B9DD0`.

The corrected sources themselves passed the new publication gate. The last gate
then bypassed that improvement by selecting older artifacts and treating a zero
compiler exit as sufficient again.

**Required:** enforce current diagnostics/policy/context acceptance after every
transformation and at final integration, regardless of producer or artifact age.
Validate freshness or explicitly revalidate historical sources. Do not assume
“was once an engine winner” implies acceptance under today's rules.

### P1 — the feedback diagnostic deletes an existing overlay

`tools/diagnostics/feedbackLoop.ts` saves the manifest, calls
`retractRecovered()` (which recursively deletes the overlay, including its source
files), and tries to reread those deleted source paths in `finally`. The catch
silently ignores restoration failures.

In an isolated nonempty-overlay test:

```
before: [ovl_21_func_800BA670]
feedback demonstrated: true
after: []
```

The existing restoration test starts empty, so it cannot detect this.

**Required:** run the diagnostic in its own overlay or snapshot the actual source
bytes before deleting anything. Preserve a caller's nonempty state, including
failure paths. This review exercised only private overlays; no user recovery
store was deleted.

### P1 — publication loses pointer return types

The new recovered-signature tier in
`tools/agent/matching-reconstruction/callee-signature.ts` reads the return type's
specifier but ignores pointer declarators. An independently verified
`void *ovl_11_func_80102844(s8, s8)` is published, then resolved as:

```
returnsValue: false
returnType: "void"
source: "recovered"
```

This turns a stronger published fact into a false restriction on callers that
use the returned pointer. Non-void return types are also flattened to `s32`.
Preserve the full declared return type, and handle unexpressible types explicitly.
The probe imports a known body solely to exercise the parser; it is **not** a
claim of cold reconstruction yield.

## 4. The original fixtures pass; the semantic classes are not closed

Re-running the first review's four counterexamples confirms the specific fixes:
argument 7 is observed after a direct-call slot, the unrelated trap is refused,
incremented loads are no longer called a copy, and forwarded `CopyVec3` arguments
retain an arity floor of two.

Nearby cases still fail:

| Component | Independent counterexample | Current result |
|---|---|---|
| `exec.ts` trap stripping | Trap on **divisor == -1 alone**, then ordinary signed division | Removes the trap and returns an unconditional division leaf. For dividend 5 and divisor -1, division is defined but the target traps. |
| `exec.ts` trap stripping | Trap on **dividend == INT_MIN alone**, with ordinary division | Also removes it; divisor 2 does not cause signed division overflow. |
| `copy-recipe.ts` | Change the source base after the first load; remaining loads come from shifted addresses | Still reports one contiguous 16-byte aggregate copy. |
| `copy-recipe.ts` | Pair `lwl` with another `lwl` three bytes away, not `lwr` | Still recognizes complete unaligned word loads and an aggregate copy. |
| `machine-ir/ssa.ts` | `jalr t9` with a slot setting `t9 = 0` | Calls through zero in SSA, rather than the target read before the slot. |
| `machine-ir/ssa.ts` | Direct `jal` with a slot copying `$ra` to `$a0` | Uses entry `$ra`, not the newly installed link address. |

Trap recognition must establish the actual packet, including the paired signed
overflow condition and its relationship to the particular division. Copy
recognition must track address webs, correct complementary unaligned operations,
and intervening effects—not only the stored value's register. Call modeling must
separate target capture, link definition, slot execution, and callee effects.

SSA and copy recognition are currently diagnostics rather than the construction
backbone. Trap rewriting does feed construction. The byte oracle remains a strong
last defense against incorrect machine output; it cannot make an incorrect
partial fact or nonmatching draft faithful.

## 5. Types and feedback: real progress, remaining boundaries

### Type names still collide, and layouts still are not published

`viewOwnerTag()` uses the final address, not the full container-qualified symbol.
The current candidate corpus contains:

```
ovl_21_func_800BAFFC: Recon800BAFFCPointee0View, field at +0x120
ovl_23_func_800BAFFC: Recon800BAFFCPointee0View, field at +0xD8
```

These are different typedef definitions with the same name. “Collision is
impossible” is false across overlays. The scan constructors also retain generic
view names. Use a complete identity, account for family instantiation, and
publish the actual shared types/layouts rather than only stamping names.

The integrator still changes one `.c` file and supplies no shared-type patch.
The unchanged exporter does not harvest overlay-local typedefs. In the new
sandbox it again prints that referenced types are “defined nowhere” and emits
opaque guessed layouts. This integration blocker is not closed.

### Donor feedback now genuinely works

The response's cold experiment reproduces exactly:

1. `ovl_11_func_800F4114` fails construction with no donor.
2. `ovl_21_func_800BA670` is reconstructed and independently verified.
3. Publication changes the overlay revision and donor index.
4. Family transfer closes the dependent.
5. Retrying construction alone still fails.

That is the causal demonstration missing in the first review. It should be
credited, not described as mere requeue scaffolding anymore.

It does not yet establish broad compounding yield. Publishing all **72** verified
winners from the parser-contained cold census opened **no additional donor-backed
unresolved target in that frozen cohort**. Those successes did not leave an
unsolved sibling in their indexed families. This probe tests donor propagation,
not renewed caller reconstruction. The demonstration's producer is outside the
remaining-stub cohort, so these observations are consistent.

`runCampaign()` also still caps every function at two attempts even if further
publications change its evidence. Its comment justifies that cap using
*unchanged* evidence, but its implementation does not test whether evidence is
unchanged. This is a bounded two-attempt campaign, not a general fixed point over
arbitrarily many legitimate context revisions.

## 6. What to do next

1. **Fix parser lifecycle and make evidence failures explicit.** Otherwise any
   long campaign can silently change the problem it is solving.
2. **Close final acceptance**, including old artifacts, transformed source,
   source policy, diagnostics, and shared context. The producer gates improved;
   they must not be bypassed downstream.
3. **Make the overlay safe:** non-destructive diagnostics, faithful signatures,
   complete identities, and revision-aware work deduplication. Preserve source
   hypotheses where byte identity does not prove a unique interface/layout.
4. **Finish the semantic fixes using architectural/operation invariants**, not
   only the first counterexample of each class. Add the neighboring failures to
   tests before connecting those analyses to source construction.
5. **Then implement the previously deferred large-code mechanisms:** one complete
   CFG-to-C slice, an executable complete-function recipe repair, and a measured
   m2c-plus-repair versus prepared-bundle agent comparison.

Recalibration: this change roughly doubles the diagnostic-acceptable candidate
pool, substantially expands compiling drafts, and proves one feedback unlock.
It does not establish 80% unattended decompilation, broad large-function coverage,
or reduced agent time. The next important gain should come from connected
construction mechanisms, but the acceptance and evidence failures above need
closing before an unattended campaign can be trusted.

## 7. Evidence / checks

All artifacts below are relative to `build/static-first-rereview/`:

- `implementation.patch`, `agent-changes.diff`, `agent-response.md`: reviewed snapshot.
- `warm/`, `cold/`: initial long-worker runs, including parser-abort stderr.
- `warm-recycled/`, `cold-recycled/`, `previous-recycled/`, `previous-part-{0,1,2,3}/`:
  controlled observations and preserved sources.
- `comparison.json`, `previous-diagnostics.json`: corrected accounting and old-source
  diagnostic audit. “Diagnostic clean” here means no rejecting diagnostics, not
  a proof of all C semantics.
- `parser-stress.ts/json/log`, `parser-control.ts/json/log`: isolated failure and
  tree-lifetime intervention.
- `race.ts/json/log`: actually concurrent target-witness control.
- `correctness-probes.json`, `adjacent-probes.ts/json`: old and neighboring cases.
- `feedback.json`, `propagation-recycled.json`, `type-collisions.json`: feedback and type evidence.
- `verification.json`: all 70 independent byte checks and actual integration plans.
- `integration-build.log`, `integration-progress.txt`, `integration-context.log`:
  58-source sandbox, whole-container match, and remaining context warnings.
- `tests.log`: **911 passed, zero failures**. These tests do not cover the newly
  demonstrated failures above.

No candidates or generated/extracted binaries were committed. Live progress
remains unchanged; sandbox progress is explicitly separate.
