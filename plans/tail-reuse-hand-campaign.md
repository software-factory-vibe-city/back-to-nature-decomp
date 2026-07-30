# Plan: tail-reuse staging campaign (func_80019070)

Status: executed — **exhausted**. Successor to `plans/deprecated/idiom-family-hand-campaign.md`
(executed: exhausted). Reuse its engine
(`build/residualSourceSearch/func_80019070/handprobe-campaign/run-campaign.mts`)
and its diagnostics; only the template and dimensions change.

Goal: byte-exact object match for `func_80019070` by enumerating
whole-function variable-reuse structures over the register-perfect idiom
baseline — the first family whose mechanism explains every previous
failure — or an honest exhaustion of that family.

## Certificate-grade context (do not re-derive)

1. **The idiom baseline** —
   `build/residualSourceSearch/func_80019070/idiom-probe/idiom.c` (raw
   `u8 *packet` cursor, typed locals `sprt`/`tpage`, per matched PSY-Q
   style) — scores 72/81 as a **pure permutation**: instruction multisets
   identical, **every register correct**. Only forward slots 1–9 are
   misordered. Target head:

   ```text
   move t0,a1 | li v0,4 | li v1,100 | move t3,a0 | andi a2,a2,65535 |
   sll a3,a3,16 | sra t5,a3,16 | andi t6,a2,15 | andi a2,a2,240 |
   lw a1,32(sp) | sb v0,3(t0) | sb v1,7(t0) | ...
   ```

2. **The boost law**, read directly from GCC 2.95 `sched.c`
   (`birthing_insn_p` + `adjust_priority`,
   `notes/scratch/gcc-2.95.2-reference/sched.c` lines ~1922–1998): an
   instruction receives launch priority iff its destination is a plain
   register assigned **exactly once in the whole function**
   (`REG_N_SETS == 1`) and live at release. Consequences:
   - "not-live-at-release" is unreachable for constants feeding in-block
     stores (their releaser is their reader);
   - a second assignment **anywhere in the function** removes the boost —
     `REG_N_SETS` is function-global.
3. **Boost removal is necessary**: with boost variables removed from the
   solver domain, the target order is UNSAT
   (`build/schedulerConstraint/func_80019070/5ec55253bb442227`, exhaustive
   within ≤3 phantoms).
4. **All entry-local unboost mechanisms fail**: 545,748 idiom-family
   variants (routing constants through variables whose other accesses sit
   near the entry window) produced zero stream-exact classes and none that
   advanced `li v0,4` while keeping the register family
   (`build/residualSourceSearch/func_80019070/idiom-campaign/`). The
   routing's live-range changes inside the entry window cascade the
   allocator.
5. **Unboosted values order by LUID** (source position, descending in the
   backward ready sort): to land at forward slots 1–3 the unboosted
   staging assignments must be the earliest statements.

Synthesis: the target compile's `li v0,4` / `li v1,100` pseudos must have
been multi-set (law + necessity), with their extra sets placed where they
cannot perturb entry live ranges — i.e. in the tail — and their first sets
at the top of the function. Every prior family froze the tail, making such
variants inexpressible by construction. Stylistically this is ordinary
1990s local-variable economy: one `u8` staging variable reused for a
length here and a width there.

## The hypothesis, as code

Identical 81 emitted instructions; different invisible set-counts:

```c
    u8 len;                      /* 4 now, width 8 later  */
    u8 code;                     /* 0x64 now, 0x64/0x66 later (sets exist) */

    sprt = (SPRT *)packet;
    len = 4;                     /* li v0,4  -> slot 1 (unboosted, min LUID) */
    code = 0x64;                 /* li v1,100 -> slot 2                      */
    glyph = (u16)glyph;
    ...
    setlen(sprt, len);           /* sb v0,3(t0) */
    setcode(sprt, code);         /* sb v1,7(t0) */
    ...
    len = 8;                     /* SECOND set, in the tail */
    setWH(sprt, len, 12);
    ...
    code = 0x64;
    if (semitransparent != 0) { code = 0x66; }
    setcode(sprt, code);
```

## Hard rules

- Never modify `src/` or pipeline-critical files; scratchpad and `build/`
  only.
- C89. The two inherited empty memory barriers keep count and relative
  position (removal was tested: 57/81, strictly worse). No new barriers,
  pragmas, or register tricks.
- Oracle: 81/81 stream match, then byte-exact `functionObjectsEqual`
  against the target object. Statuses: `running`/`exact`/`exhausted` only.
- Promotion is manual and out of scope. It requires the idiom's signature
  ripple (`u8 *packet`, struct removal) through the normal finalization
  workflow.

## Dimensions

**Frozen:** the idiom baseline's signature, typed locals, barriers,
branch bodies, and everything not explicitly listed below.

**D1 — reuse pairings (the mechanism).** Enumerate which staging variable
absorbs which tail value. Staging candidates for the entry constants `4`
and `0x64` (via `setSprt` split into `setlen`/`setcode`); tail
second-set hosts, no longer frozen:

- `setWH(sprt, 8, 12)` — the `8` and/or the `12` through a staging
  variable (`len = 8; setWH(sprt, len, 12);` etc.);
- `setDrawTPage(tpage, 1, 1, 0xE)` — its literal arguments likewise;
- `code`'s existing later sets (`0x64`/`0x66`) — already multi-set; the
  `0x64` staging via `code` needs no new tail edit;
- pairings must be type-representable (u8 range) and semantics-preserving
  (the staging variable dead between its entry read and tail set under
  every admissible order — derive with the semantic graph, do not assert).

Include single-constant and both-constant variants; include the control
(no reuse). Bound: all pairings of {4, 0x64} × {setWH args, setDrawTPage
args, code-sets, none} — tens of combinations. New variables allowed
(`len`) but flag `addsPseudo` when a variant's local count exceeds the
idiom baseline's; prefer reusing the existing `code`/declared names where
semantics allow.

**D2 — entry statement and declaration order.** For each D1 variant,
enumerate ALL admissible orders of the entry window (function start to the
first barrier) with machine-derived dependencies
(`buildSemanticGraph` + `regionDependencies` + `RegionOrderModel`), and
2–3 declaration orders. The unboosted staging assignments must be able to
take the earliest LUIDs, so include orders with them first.

**D3 — tail placement.** The tail second-set's position within its own
region (between the third barrier and `addPrim`), machine-derived
dependencies again. Small (the region has few statements).

Scale: tens of pairings × low thousands of orders — well under the
previous campaign's 545k.

## Diagnostics per class (same engine, same fields)

`permutationExact`; `registerFamilyIntact` (`move t3,a0`, `sra t5,a3,16`,
`lw t7,36(sp)` present); `clusterAdvanced` (earliest slot of `li v0,4`;
target 1); plus `boostObserved`: parse the candidate's `.sched` dump ready
lines — the staging `li`s must show priority `(1)`, not `(7f000001)`.
That last check verifies the mechanism directly instead of inferring it
from final order, and separates "reuse failed to unboost" from "unboosted
but mis-ordered".

Rank: (objectExact, streamExact, registerFamilyIntact, boostObserved,
clusterAdvanced asc, exact desc).

## Decision tree

1. Sweep D1×D2 with D3 at baseline. Any 81/81 → object-confirm → STOP.
2. If unboost confirmed (`boostObserved`) with family intact but order
   still wrong: sweep D3 and the remaining declaration orders; the LUID
   competition among unboosted priority-1 instructions is decided by
   source position, so this is where fine order matters.
3. If no variant unboosts while keeping the family: the hypothesis is
   wrong. STOP; record; rerun the high-bound scheduler search
   (`--max-assignments 10000000`) on the best `boostObserved`
   representative and append its witness here.
4. Do not widen dimensions silently; a widening is a new plan revision.

## Mechanics

As the previous campaigns: `establishBaseline` once against
`src/func_80019070.c` for target stream/object; template rendering;
`compileSourceAsync` worker pool; assembly-hash dedupe; `state.json`
resume; artifacts under
`build/residualSourceSearch/func_80019070/tail-reuse-campaign/`
(`summary.md`, `campaign.jsonl`, `classes/`). The `.sched` dump for
`boostObserved` comes from `compileSource(..., { dumps: true })` on class
representatives only (not every candidate).

## Execution record

The bounded campaign completed under
`build/residualSourceSearch/func_80019070/tail-reuse-campaign/` with status
**exhausted**:

- D1/D2 phase: 872,340 complete candidates across 28 recorded pairings;
- conditional D3/declaration phase: 576 candidates from 72 qualifying class
  representatives;
- total compiled: 872,916;
- normalized assembly classes: 148;
- stream-exact classes: 0; object comparison was therefore not reached;
- maximum instruction score: 72/81, the unchanged permutation-exact idiom
  baseline class `f3d28f655414fd9d`;
- 72 representative classes showed both entry constants at scheduler priority
  1 while retaining all three register-family canaries.

The named mechanism was directly confirmed, but it did not produce the target
allocation: the unboosted `4` and `0x64` constants were assigned to non-target
hard registers, `li v0,4` was absent, and the first instruction after the
entry move remained an `andi` or a wrongly allocated constant load. The best
boost-confirmed family scored 34/81. Crossing every recorded D3 insertion with
the remaining declaration orders created no new normalized assembly class.

The exact semantic-graph domain is larger than the plan's rough scale estimate;
the machine-derived entry model has 80,640 orders for the separate `len`/`code`
shape. The exact counts and dependencies are preserved in
`configurations.json`, and resumable progress is in `state.json`.

The executable idiom baseline and D3 text contain three inherited empty memory
barriers despite the hard-rule sentence saying two. All three were preserved;
none were added. Decision-tree branch 2 applied, so branch 3's scheduler rerun
was not triggered. `src/func_80019070.c` was not modified.
