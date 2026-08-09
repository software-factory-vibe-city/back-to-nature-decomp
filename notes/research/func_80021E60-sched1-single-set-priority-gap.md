# func_80021E60: sched1 launch-boost/pending-flush ordering gap in a flat store block

**Date:** 2026-07-31 (rewritten after full mechanism diagnosis)
**Status:** **SOLVED — 92/92, byte-verified in the linked binary.** See §8.
The fix was source statement order, not webs or boost suppression: both store
blocks in natural ascending offset order (`0x5D8C` first, counts `c[0]..c[18]`
in offset order). No register pins, barriers, or flag overrides.

## 8. Resolution (2026-07-31)

Two observations cracked it, both found by mining the *data* instead of the
schedule:

1. **The values are self-referential.** The 19 pointers are exactly
   `base + 0x18 * cumsum(counts)` (verified for all 18 deltas; 197 elements,
   ending at +0x1278). The block initializes a pool-carving table — adjacent
   parallel arrays `ptr[19]` / `u16 count[19]` — so the original source
   naturally wrote entries in ascending order, not the permuted order the
   binary emits.
2. **CSE'd constant `li`s are born in source first-use order, and the target's
   li emission order is exactly first-use order under ascending count order**
   (`4, A, 16, C, 10, 7, 5, D, B, 9, F, 2`). The 63/92 candidate's `sh` order
   had been reverse-engineered from the *emitted* store order, which poisoned
   the birth order (`4, 16, 10, A, C, ...`) — sched1/sched2 shuffle the
   stores, but pseudo birth order, LUIDs, and lifetimes come from statement
   order. Everything downstream (the `$a2`-parked 0xA, the late `sw 0x5DCC`,
   the a1/a2 swap) was a symptom of birth order and register pressure, not of
   shared webs.

Blocked-ascending (all 19 `sw` ascending incl. `0x5D8C` first, then all 19
`sh` ascending) matched 92/92 on the first compile and byte-verified via the
full gate. The §5 "structural blockers" were artifacts of fitting the
simulator to a sched2-contaminated witness under the wrong source order:
`sw 0x5D8C` emitting 17th is WAR-pinned by the in-place
`addiu $v1, $v1, 0x1248`, and 0xA landing in `$a2` follows from its early
birth (first use `c[1]`) plus leapfrog pressure — no multi-set web needed.

**Lesson:** when a store block mismatches only in order, first mine the stored
values for arithmetic relationships and match the constant first-use order;
write the source in natural data order and let the scheduler do the shuffling.
This is now standing doctrine — see the style guide's "Store-block
initializers: order from the data, never from emission" (§2) and its
flat-initialized lookup-table pattern (§12), automated by
`psx_analyze_store_block` at step 5 of the decompile-function skill loop.

---

Historical diagnosis below (pre-resolution; §5's blockers turned out to be
artifacts of the permuted source order, see §8).

## 1. Function summary

`func_80021E60(s32 arg0)` initializes fields of the large global `D_8006C838`:

1. **Unconditionally** stores five global addresses at offsets 0x20–0x34
   (`&D_8004B1A4`, `&D_80049B1C`, `&D_8004AFBC`, `&D_8004B044`, `&D_80054BC8`).
2. **Conditionally** (`arg0 == 0`) initializes `D_8006C838 + 0x8000`:
   - 19 pointer values derived from `&D_8004ED04 + offset` (`sw`, offsets
     0x5D8C–0x5DD4; the 0x5D8C entry stores the base itself),
   - 19 halfword constants (`sh`, offsets 0x5DD8–0x5DFC): values
     `4, 0x16, 0x10, 0xA, 0xC×4, 7, 5, 0xB, 9, 0xD×2, 0xF, 2, 0xA×2, 2`.

Caller: `func_80011370`. The first 63 instructions (prologue, block 0, branch,
and the entire pointer-store section) match exactly. The remaining 29
instructions — the `li`/`sh` tail plus the two last `sw` — are **semantically
identical and differ only in order** (`scheduling-and-operands`).

## 2. Scheduler mechanics that control this block

All facts verified against the vendored/reference GCC 2.95.2 `sched.c` and the
candidate's `.sched` dump. sched1 schedules **backward** (last instruction
selected first); emission is the reverse of selection.

1. **Pending-list flush** (`sched_analyze_1`): memory insns accumulate on
   pending lists; when a memory write is processed with
   `pending_lists_length > 32`, the lists are flushed — the new write gets
   `REG_DEP_ANTI` links to **all** pending memory insns, and later writes
   depend only on the flush insn. With 38 mem writes in this block, the
   **34th write in RTL order** (`sh 0x5DF4`) becomes the serialization point:
   the 4 post-flush stores (`5DF6/5DF8/5DFA/5DFC`) are the only initially
   ready insns, and the other 33 stores are all released the moment the flush
   insn is scheduled. The flush lands on the 34th write *regardless of store
   order*; only its identity depends on RTL order.
2. **Single-set launch boost** (`adjust_priority` + `birthing_insn_p`):
   `REG_DEAD` notes are unlinked from all insns before the scheduling loop, so
   the death-count path is dead code. A newly-ready insn whose destination
   pseudo has `REG_N_SETS == 1` **and** is in `bb_live_regs` is boosted to
   `LAUNCH_PRIORITY` (`0x7f000001`) and wins the next cycle outright. This is
   what the candidate's fresh per-value constant webs do: each `li` fires
   immediately after its consuming store is scheduled. A pseudo live at its
   launch is guaranteed (its last-scheduled reader leaves it live), so the
   only clean suppression is `REG_N_SETS ≥ 2`. **Caveat:** `combine`
   *decrements* `REG_N_SETS` when it deletes a merged set, so
   `t = 6; t += 4;`-style tricks collapse back to 1 and do **not** suppress
   the boost.
3. **Memory-unit hazard re-pick** (`schedule_select`/`potential_hazard`):
   within one priority group, an insn using the memory unit (any store) beats
   non-memory insns (`li`/`addiu`) regardless of LUID; equal-unit insns keep
   list order (LUID descending). Observed verbatim in a `.sched` dump:
   *"insn 188 has a greater potential hazard, now 188 215 …"*.
4. Base priority is 1 for everything here (all latencies 1), so the selection
   rule reduces to: boosted insns first; then stores by descending LUID; then
   `li`/`addiu` by descending LUID.
5. **sched2 conflation warning:** the final emission is sched1 + greg +
   sched2. sched2 (no boosts after reload, hard-register WAR chains) reorders
   this block heavily; the "target backward order" produced by
   `searchSchedulerState.ts`/`analyzeTargetSchedule.ts` is final-emission
   derived and is **not** a pure sched1 witness, especially in the
   pointer-section prefix. Validate hypotheses against the whole pipeline,
   not just a sched1 replay.

## 3. Validated simulator

A ~100-line Python model of the above rules (web true/WAR/WAW edges, base
deps, flush at the 34th write, launch boost, hazard re-pick) reproduces the
candidate's dumped sched1 selection **72/72 exactly**. It is the recommended
way to test source-shape hypotheses before compiling. (Scratch copy from the
diagnosis session: `/tmp/schedsim/sim.py` + `merged.py`; not checked in.)

## 4. What the target order implies about the original source

Decoding the target with the simulator gives a consistent picture: the
original used **reused named temporaries** whose WAR chains gate the cascade
(one web = one hard register; the target's register evidence pins the
partition):

| web | hard reg | pointer values (in order) | then constants |
|---|---|---|---|
| `t0` (s32) | `$a0` | +0x60, +0x360, +0x5A0, +0x840, +0xA08, +0xBB8, +0xDF8, +0x1038, +0x1158 | 4, 0xC, 5, 9, 2 |
| `t1` (s32) | `$a1` | +0x150, +0x480, +0x6C0, +0x960, +0xA80, +0xCF0, +0xED0, +0x1068 | 0xD |
| `ptr` (s32) | `$v1` | base, +0x1248 (reassigned) | 0x16, 0x10, 7, 0xB, 0xF |
| `t2` | `$a2` | — | 0xA (single set) |

Every target launch/gating in the tail matches the WAR chain of these webs
(e.g. `sw 0x5DD4` is gated by the next `ptr` set `= 0x16`; `sw 0x5DCC` by
`t1 = 0xD`; `li 4` launches only after `sw 0x5DD0` frees the `t0` web, etc.).
The candidate instead uses fresh single-set expressions: all its `li`/`addiu`
insns are boost-launched immediately after their consumer, producing the
wrong interleaving.

A source built on this structure (reused temps + derived statement order)
simulates to the target tail selection exactly, **except one forced
deviation** (§5.2).

## 5. The two structural blockers

### 5.1 base2's web must be multi-set

The entry insns (`li 0x8000` / `addu` for base2, `lui`/`lo` for `ptr`) are
selected last in backward order. In the target, `addu` (uid 50) loses to the
first two `addiu`s and the `ptr` pair; that requires base2's web (`v0`) to be
**unboosted**, i.e. multi-set. With a plain `base2 = base + 0x8000` (single
set), uid 50 is boost-launched ahead of the (now unboosted, multi-set) first
`addiu`s; the entry order comes out as `lui/lo/li/addu` instead of
`li/addu/lui/lo`, which cascades into `v0`/`v1` misallocation for `ptr`
(experiment V4).

The only found multi-set shape — reusing a block-0 address temp for base2
(the `v0`-colored block-0 address webs are legitimately the same variable) —
makes the web **global** (spans both blocks), and greg then assigns it `$a1`
instead of `$v0`, scrambling everything (experiment V5). Open: a clean-C
shape giving the base2 web a second set while keeping it local and `$v0`.

### 5.2 The constant 10 (`$a2`) cannot be unboosted

The `10` web is alone in `$a2` (nothing else in the function uses `$a2`), so
it cannot merge with any pointer/constant web without changing the binary's
register evidence. It cannot get a second set: a redundant `t2 = 10;` is
deleted or emits a second `li`; `t2 = 6; t2 += 4;` is folded by combine which
decrements `REG_N_SETS`; a block-0 set would need an `$a2` user in block 0
(there is none); the not-in-`bb_live_regs` escape is impossible because its
last-scheduled reader always leaves it live (the RTL-last reader — the flush
constrained `sh 0x5DFA` — is scheduled first and is not the last). In the
simulator its `li` is therefore boost-selected one cascade slot early
(cycle 9 instead of 32); the remaining 24 tail insns keep the exact target
relative order around it. Whether sched2 absorbs this one-slot rotation is
untested because blocker 5.1 currently breaks the prefix first.

## 6. Experiments

Older round (pre-diagnosis, on the fresh-expression shape): flag probe ruled
out overrides (baseline dominates; `-fno-schedule-insns*` drops to 11/92);
8 `psx_fuzz_variants` shapes (store reordering, reused value temps, early
constant hoisting, alternate address families, interleaving, named constant
locals, expression-born constants) all ≤ 63/92 — consistent with the boost
mechanism being untouched. `searchSchedulerState.ts --block 1` was
INCONCLUSIVE at 10M assignments (its domain cannot express the flush/web
structure; its reported "single-set bonus" blockers are the launch boosts of
§2.2). `psx_synthesize_source_shapes` refuses (mismatch is inside an `if`
body, outside the prologue subset).

Diagnosis round (on the decoded reused-temp shape):

| variant | shape | score | lesson |
|---|---|---|---|
| V1 | only reorder sh stores (5DDA after 5DF2) | 63/92 | statement order does perturb the tail, but not the boost structure |
| V2 | u16 temps t0/t1 + literals | 6/72 (sim) | natural temp placement ≠ derived LUID order; skipped compile |
| V3 | all four u16 temps, derived tail order | 20/92 | temps became SI webs; revealed the hazard re-pick in the dump; prefix allocation broke |
| V4 | s32 merged temps (t0/t1/ptr reused), derived order | 14/92 | tail structure correct, but boosted base2 (uid 50) broke entry order → `v0`/`v1` misallocation |
| V5 | V4 + base2 merged into block-0 `v0` temp | 17/92 | boost fixed structurally, but greg gives the global web `$a1` not `$v0` |

## 7. Conclusion

This is **not** a "clean-C frontier of unknown cause" anymore: the mismatch
is a fully decoded sched1 launch-boost pattern whose source-level cause is
reused named temporaries. The remaining gap is two concrete obstacles:
finding a clean-C shape that (a) makes the base2 web multi-set while
preserving local `$v0` allocation, and (b) suppresses or absorbs the
single-set boost of the `$a2` constant 10. If both fall, the merged-temp
source in §4 is expected to match; (a) is the immediate next experiment.
If (b) proves truly unreachable, the best achievable clean-C score is the
63/92 already present plus whatever prefix-preserving subset of the §4
structure compiles cleanly.
