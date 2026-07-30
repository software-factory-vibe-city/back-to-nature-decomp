# Plan: scripted campaign over the SDK-idiom source family (func_80019070)

Goal: find the byte-exact object match for `func_80019070` by sweeping the
bounded neighborhood of the register-perfect idiom source, or prove that
neighborhood insufficient. Successor to
`plans/probec-family-hand-campaign.md`; reuse its engine
(`build/residualSourceSearch/func_80019070/handprobe-campaign/run-campaign.mts`)
as the reference implementation — only the template, dimensions, and
diagnostics change.

## Context you must not re-derive

- `src/func_80019070.c` (72/81) models the packet as a struct
  (`SpritePacket` with `&packet->sprite` field paths). That representation
  is an invention and was silently costing the entire register assignment.
- The real idiom, taken from matched PSY-Q code
  (`tools/vendor/silent-hill-decomp/src/bodyprog/text/text_debug_draw.c`):
  a raw `u8 *packet` cursor cast into typed locals per primitive
  (`sprt = (SPRT *)packet;` … `tpage = (DR_TPAGE *)packet;`), advanced with
  `packet += sizeof(SPRT)`. The typed locals are exactly the coalescible
  copies the scheduler witnesses kept demanding — ordinary SDK style.
- The rewritten function,
  `build/residualSourceSearch/func_80019070/idiom-probe/idiom.c`, scores
  **72/81 as a pure permutation**: the candidate and target instruction
  multisets are identical (verified) and **every register in the function
  is correct** (`li v0,4`/v0, `li v1,100`/v1, `move t3,a0`/t3, `sra t5`,
  `andi t6`, `lw a1,32(sp)`, `lw t7,36(sp)`, `lh t4,16(sp)`). The nine
  mismatches are slots 1–9 order only:

  ```text
  slot: 1..9
  cand: andi a2,a2,65535 | andi t6,a2,15 | andi a2,a2,240 | li v0,4 |
        li v1,100 | move t3,a0 | sll a3,a3,16 | lw a1,32(sp) | sra t5,a3,16
  tgt:  li v0,4 | li v1,100 | move t3,a0 | andi a2,a2,65535 |
        sll a3,a3,16 | sra t5,a3,16 | andi t6,a2,15 | andi a2,a2,240 |
        lw a1,32(sp)
  ```

- The corrected scheduler model (memory-unit hazard semantics; replays
  this block 21/21) produced a SAT witness **from the idiom baseline**:
  `build/schedulerConstraint/func_80019070/27bcae5c880cf162`. Requirements:
  - remove the birth boosts of UID 62 (`li v0,4`, $v0), UID 66
    (`li v1,100`, $v1), and UID 73 (`sra t5`, $t5) through multi-set or
    not-live-at-ready webs;
  - two scheduler-visible coalescible readers: of UID 4/pseudo 81 (the
    `move t3,a0` ordering-table entry copy) and of UID 62/pseudo 106 (the
    `li v0,4` value);
  - the witness carries explicit **allocation warnings**: every mechanism
    changes web structure around currently-correct registers.
- Those warnings are real. Two combinations already failed by perturbing
  the pseudo structure that produces the perfect registers:
  - `idiom3.c` (split `setSprt`, `4` through `code`, `0x64` through a NEW
    `clut_index` local): 46/81, register family collapsed.
  - `idiom4.c` (split `setSprt`, `4` through existing `code` only): 49/81,
    the early `sb v0,3(t0)` changed live ranges and the family collapsed.
  Lesson: the unboost mechanisms must be applied while preserving the
  pseudo-birth structure — that coupled constraint IS the search.

## Hard rules

- Never modify `src/` or pipeline-critical files. All work in the
  scratchpad or under `build/`.
- C89; the two inherited empty `__asm__ volatile("" ::: "memory")`
  barriers keep their count and relative positions; no new barriers,
  pragmas, or register tricks.
- Oracle: byte-exact object equality via the configured pipeline
  (`functionObjectsEqual` after `compileSource(..., { assemble: true })`),
  after an 81/81 stream match. Never claim more than the record shows.
- Promotion is manual and out of scope for the campaign. Note for whoever
  promotes: the idiom changes the second parameter's type (`u8 *packet`)
  and deletes the `SpritePacket` struct — prototypes, callers, and shared
  type headers must go through the normal finalization/ripple workflow.

## The family to enumerate

**Frozen (do not vary — this is what already matches):** the u8-cursor
signature, the typed locals `sprt`/`tpage`, `palette_index` kept as a
variable, the entire body from the first barrier (`glyph >>= 4;`) through
`addPrim(ordering_table, sprt);`, the packet advance, and the tpage tail —
except for the specific toggles below. Base template: `idiom.c` verbatim.

**Dimension 1 — constant routing (the unboost mechanisms).** The entry
window builds the SPRT header; enumerate how the `4` and `0x64` reach it:

- `setSprt(sprt)` intact (constants literal; control case);
- split into `setlen`/`setcode` with each constant independently literal
  or routed through an EXISTING variable: the `4` through `code` (its
  later `0x64`/`0x66` sets make it multi-set) and the `0x64` through
  `code`, `palette_index`, or `sprite_x` (each has later sets or later
  first-sets; each choice must keep semantics: route only when the
  variable is dead at that point in every admissible order — derive the
  dependency edges from the semantic graph, as the engine's model does);
- the same routings with the two component statements at every admissible
  entry position (dimension 3 covers order).

New locals are permitted only as a last resort and must be flagged in the
results (`addsPseudo: true`) — both failures so far involved pseudo-count
or live-range changes, so pseudo-conserving variants are searched first.

**Dimension 2 — zero-cost reader toggles (the phantom requirements).**
Forms that add scheduler-visible readers without new statements:

- `return packet + sizeof(DR_TPAGE);` vs
  `return (u8 *)tpage + sizeof(DR_TPAGE);`
- second `addPrim(ordering_table, tpage)` vs an ot alias split between the
  two consumers (only if pseudo-conserving);
- `setlen(sprt, code)` ordering relative to `code`'s birth when the `4`
  routes through it (already covered by order, listed for clarity).

**Dimension 3 — entry-region statement order.** For each routing variant,
enumerate ALL admissible orders of the entry statements (the window from
the function's first statement to the first barrier) under
machine-derived dependency edges — use `buildSemanticGraph` +
`regionDependencies` + `RegionOrderModel` from
`tools/agent/residual-source-search/`, not hand-asserted edges (the
routing changes the statement list per variant, so derive edges per
variant). Region sizes stay ≤ 12 nodes; counts per variant are in the
thousands at most.

Rough scale: ~10–20 routing×toggle combos, a few thousand orders each —
under 100k compiles. The scheduler collapses most orders; expect tens of
distinct classes.

## Diagnostics to record per class

Alongside the standard fields (exact count, first divergence, head,
members, representative source):

- `permutationExact`: candidate and target instruction multisets equal;
- `registerFamilyIntact`: `move t3,a0`, `sra t5,a3,16`, and `lw t7,36(sp)`
  all present in the stream (the canary for the allocation that must not
  be lost);
- `clusterAdvanced`: the earliest slot of `li v0,4` (target: 1).

These give the graded signal: a variant with `registerFamilyIntact` and a
lower `li v0,4` slot is progress even below 72/81; a variant at 75/81
without the family is a dead end. Rank classes by
(objectExact, streamExact, registerFamilyIntact, clusterAdvanced asc,
exact desc).

## Decision tree

1. Sweep dimension 1×3 pseudo-conserving variants with baseline toggles.
   Any 81/81 stream class → object-confirm → STOP and report the source.
2. If classes fix boosts but lose the family (the idiom4 signature),
   cross with dimension 2 toggles — the readers are the witness's
   counterweight to the allocation shift.
3. If pseudo-conserving variants exhaust: admit the flagged
   pseudo-adding variants (new local for the `0x64`), full cross.
4. If the family exhausts with no exact: STOP. Report the class record;
   rerun `searchSchedulerState` (with `--max-assignments 10000000`)
   against the best `registerFamilyIntact` representative and record the
   next witness in this plan. Do not widen dimensions silently.

## Mechanics

Identical to the probe-C campaign: `establishBaseline` once against
`src/func_80019070.c` for the target stream/object; render candidates from
the template; per-worker compile via `compileSourceAsync`; dedupe by
normalized assembly hash; `state.json` checkpoint with resume;
`summary.md` + `campaign.jsonl` + `classes/` under
`build/residualSourceSearch/func_80019070/idiom-campaign/`. Statuses:
`running` / `exact` / `exhausted`, nothing vaguer.

## Execution record

Status: **exhausted**.

The campaign is recorded under
`build/residualSourceSearch/func_80019070/idiom-campaign/`.
It compiled all 545,748 members of the recorded finite domain into 277
normalized assembly classes:

- phase 1: 88,676 pseudo-conserving routing/order members;
- phase 2: 177,352 reader-counterweight members (triggered because 24 phase-1
  classes advanced `li v0,4` while losing the register family);
- phase 3: 279,720 flagged new-`header_code` members.

No class was stream-exact, so object confirmation was not reached. Class
`f3d28f655414fd9d` remained the best register-family-intact representative at
72/81 and was the only permutation-exact class. No register-family-intact
class advanced `li v0,4` ahead of slot 4. The best advanced class was
`c793c10ac4ec62f9` at slot 1 and 59/81, but it lost the canary allocation.

The executable `idiom.c` baseline contains three inherited empty memory
barriers despite the earlier hard-rule sentence saying two; the campaign
preserved all three rather than deleting an inherited barrier.

The required post-exhaustion scheduler search was run against
`f3d28f655414fd9d` with `--max-assignments 10000000`:

- status: SAT;
- exact baseline replay: 21/21;
- 1,003,661 assignments and 91 structural alternatives;
- artifacts: `build/schedulerConstraint/func_80019070/8148d17997cfdcb4`;
- changed boosts: UID 64 on→off, UID 73 on→off, UID 69 on→off;
- phantoms: read UID 4/pseudo 81 at selection 19 (LUID 9), and read UID
  64/pseudo 101 at selection 12 (LUID 16).

This new SAT witness is diagnostic only and is not a matching source. See
`build/residualSourceSearch/func_80019070/idiom-campaign/next-witness.json`
and `summary.md` for the durable record. `src/func_80019070.c` was not modified.
