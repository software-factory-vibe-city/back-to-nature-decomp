# func_80020E58 — allocation residual after inlining fix (79.4%)

Status: 220/277 words (79.4%), count delta +1 (one extra `move` in case 0xA).
Semantics are EXACT (inventory clean, web parity clean modulo jtbl/.rodata naming).
The residual is pure register allocation plus one copy, in four case blocks.

## What fixed 76.2% → 79.4%

Inlining the `(&D_8006BF48)[D_8005E554]` expression (instead of a `value` local)
in case 0x28 and case 0xA fixed:
- the case 0x28 head `lui s0`/`addiu s1` swap ([19]/[20]);
- most of case 0xA (the memcpy argument block).

The inline form moves the CSE'd load's RTL birth to the first-use site, which
changes scheduler tie-breaks. Cases 0x1E/0x32 MUST keep the `value` local: the
target reuses the value in s0 across the func_80014988 call (for func_800215EC),
and the inline form makes the compiler RELOAD the global after the call (alias
analysis cannot prove the callee leaves D_8006BF48[E554] unchanged).

## Remaining diffs (43 words)

1. Case 0x28 second half (~22 words): the C028/C068/BFA8 base addresses get
   v1/t0/v1-reused in the candidate vs v0/a3/a2 in the target; E560*4/E548/E554
   get t1/t2/a1 vs t0/t1/v1. All driven by the BFA8 base's scheduler emission
   position (candidate emits it late, after BF88; target emits it early, right
   after C068's base, before the E560/E548/E554 loads).
2. Case 0xA (~6 words): the E544 value pseudo is allocated a3 with a
   `move a2,a3` copy (the +1), instead of a2 directly; `li v1,60` vs `li v0,60`
   for the D_8005E538=0x3C constant; branch targets shifted by the +1.
3. Case 0x1E/0x32 (~10 words): the 49370 base register a1 (candidate) vs v1
   (target), plus the address register that follows. Driven by the base's
   emission position: candidate emits `lui 49370` early (filling the E554-load
   gap, while v1 holds the live BF48 base), target emits it late (in the
   value-load gap, after the BF48 base dies, so it can take v1).

## Case 0xA move — proven blocked

The E544 value pseudo P is used by the store `sw P,0(v0)` (in the call's delay
slot) and the call arg copy `a2 = P`. For P → a2, the copy's a2-write must not
fall inside P's live window [load, store]. The legacy scheduler ALWAYS emits the
copy before the store: both become ready after the call, and at equal priority
the store wins the delay-slot position on the rank_for_schedule class tie
(store is REG_DEP_ANTI on the call = class 2; copy is data-dependent = class 1;
higher class wins). The copy therefore lands inside P's window, a2 is excluded,
P → a3, copy stays. The instrumented local-alloc oracle confirms 211:$a2 is
rejected ("hard-lifetime-change", `explicit $a2 live 107..114 overlaps role
105..113`).

The target's RTL must have loaded E544 DIRECTLY into a2 (a hard-reg load, the
store using a2), which requires the value pseudo to be single-use (folded by
combine) — impossible while the store shares the value. Statement order
experiments (store-first/call-first/assignment-inside-arg) all compile to the
same or worse RTL. No clean-C shape tested reaches the target's single load in
a2 with a delay-slot store reusing it.

## Experiments tried (all measured)

- Store/call statement swap in 0xA: 72.1% (restructured block, reload).
- `s32 vab = D_8005E544` local after memcpy: identical output (CSE merges).
- Function-scope `vab` shared 0xA+0x3C: 72.9% (broke 0x3C; DCE'd anyway).
- Function-scope `value` shared across all blocks: 66.7% (became a global
  allocno, forced s2, frame grew).
- Inlining `value` in 0x28/0xA: 79.4% (kept).
- Inlining `value` in 0x1E/0x32: 74.3% (reloads after the call).
- Shared `tab` pointer for 49370 in 0x1E/0x32: 79.0% (offset addressing
  `4(v0)` — wrong address form; target uses separate addu's).
- Assignment-inside-call-arg in 0xA: identical output.

## What a future tier could try

- The base-register differences (case 0x28, 0x1E/0x32) all trace to the
  scheduler's emission position of promoted single-set `lui`/`addiu` leaf
  insns. The target emits them in load-use gaps; the candidate emits them
  early. A source change that makes these bases multi-set (REG_N_SETS > 1)
  without changing the address form (no offset sharing) is the untested lever.
- Case 0xA needs the store's value to flow into a2 without an intermediate
  copy — no tested C shape produces this; if it exists, it changes the RTL so
  the copy is not created (not merely re-scheduled).

## Second session findings (79.4% state)

Re-derived the classification: semantic inventory still exact; count delta
still the single `move a2,a3` in case 0xA.

- Case 0x1E/0x32 emission POSITIONS already match the target exactly (the
  49370 base `lui`/`addiu` sit in the value-load gap, positions 10/12 vs the
  target's 80021148-50/800211CC-D4). The residual is a pure ALLOCATION ORDER
  swap: target allocates E554 → v0 before BF48-base → v1; candidate allocates
  BF48-base → v0 then E554 → v1, leaving the 49370 base to a1. The allocation
  order (qty priority = refs/lifetime) apparently ranks the two the same, and
  the winner is a tie-break the source does not reach. The scheduler
  (legacy sched.c rank_for_schedule) breaks priority ties by dependence class
  then LUID, so this is not addressable by statement order within the
  semantics-preserving closure (residual-source-space confirmed 1 candidate).
- Variant D (moving the C068/BFA8 statement before the C028 store in case
  0x28) made the C028 base take v0 (matching the target) but shifted the
  E554/E548/E560 load registers and scored worse overall (211/276). The
  target's case 0x28 base order (C028, C068, BFA8 early; BF88 late) is NOT
  the RTL birth order (C068, BF88, BFA8 — the expander evaluates the index
  B[i] before the outer array base), so the target's BFA8-early emission
  comes from a scheduler choice the candidate does not repeat.
- A function-scope `vab` variable genuinely set in both case 0xA and 0x3C
  (REG_N_SETS = 2, verified in the trace: `sets: 2`) did NOT change the case
  0xA E544 load's first-emission or a3 allocation: even unpromoted, the load
  is emitted first because its consumer copy is scheduled early, and the
  copy's a2-write still lands inside the value's live window. This closes the
  REG_N_SETS lever for case 0xA.
- Pointer-typed D_8005E548/D_8005E54C conflict with globals.h and were not
  pursued (inventory is clean; types are not the lever).

## Third session — read by pipeline reversal (2026-08-15)

`npx tsx tools/agent/reversePipeline.ts func_80020E58` reproduces the two
sessions above automatically, and corrects one of their readings.

**The count delta is not a semantics problem.** The extra `move a2,a3` is a copy
the target's allocator coalesced away: local-alloc gave the E544 value `$a2`
directly, which made the copy a no-op move, and `jump_optimize` deleted it. Both
programs contain the same instructions — the tool's `lreg` waypoint (instruction
population under register masking) agrees exactly, 212 webs against 213 with the
coalesced copy accounted for. The residual owner is local-alloc, not expand or
combine. The first session's `diffFunc` reading, "a count delta is STRUCTURAL —
fix source semantics first", is the oracle's general rule and is wrong for a
coalesced copy specifically.

**Ten independent decisions account for all 43 differing words.** Nine are
scheduling positions and one is the coalescing choice:

| # | Block | Value | Target vs candidate position |
|---|---|---|---|
| 1 | 3 | the `move a2,a3` copy | coalesced vs kept |
| 2 | 2 | `D_8006C068` | 35 vs 38 |
| 3 | 2 | `D_8006BFA8` | 36/40 vs 50/51 |
| 4 | 2 | `sw t1,0(v0)` | 45 vs 44 |
| 5 | 2 | `addu t0,t0,a3` | 66 vs 52 |
| 6 | 3 | `D_8005E544` | 25 vs 23 |
| 7, 9 | 6, 8 | `D_8005E554` | 3 vs 4 |
| 8, 10 | 6, 8 | `D_80049370` | 8 vs 5 |

Decision 3 is the BFA8 base the first session identified by hand. Decisions 8
and 10 are the 49370 base of cases 0x1E/0x32. The 32 differing register
assignments are consequences of these, not independent problems: local-alloc
runs over the sched1 order, so one value scheduled twelve positions late
displaces every quantity after it.

**What that changes about the next attempt.** The second session concluded the
0x1E/0x32 residual was "a pure ALLOCATION ORDER swap … not addressable by
statement order". The reversal reads the same blocks as a *scheduling* residual
with an allocation consequence, because those blocks show both a transposition
and an allocation difference, and allocation cannot observe sched2. The lever is
therefore the sched1 birth order of the `D_80049370` base, not the allocator.

## Fourth session — measured mechanism tests (2026-08-15)

Re-derived the block-6 sched1 order directly from the `.sched` per-cycle log
(picks are bottom-up; the emission list is their reverse). Key finding:
the candidate's sched1 order for case 0x1E/0x32 is already
**target-equivalent** except for one insn — the `D_8005E54C` load (the a3
call arg), which sched1 places at position 2 (early) in the candidate but
the target holds at position 18 (just before the call). The other
"transpositions" (lw E554 vs addiu-lo-BF48; the 49370 `lui` position) are
SCHED2 movements in the candidate: with the 49370 base allocated to $a1
(a free register) the post-reload scheduler hoists the `lui` early; the
target's base sits in $v1, where a WAR hazard on the BF48 base pins it
late. Same story for case 0x28: the second-half bases (C028/C068/BFA8)
allocate to $v0/$a3/$a2 in the target and $v1/$t0/$v1 in the candidate,
and every final-order difference is a sched2 consequence of that.

So the residual is a LOCAL-ALLOC problem in disguise: the allocation
order (quantity priorities / conflict sets), not the sched1 order, is the
real branch point. `searchSchedulerState` cannot run (block ambiguity),
and `analyzeTargetSchedule`'s comparator fails to reproduce the
candidate's own sched1 at cycle 22 / sched2 at cycle 18 — its
target-order replay is unsupported (ambiguous correspondence), so its
"requirements" are downgraded to soft/inferred and were treated as such.

Measured this session (each edit compiled and scored against the staged
residual, never batched):

| Variant | Change | Verdict | Residual effect |
|---|---|---|---|
| `entry` local in case 0x28 (first statement) | index temp | `identical` | CSE'd away — the inline-index form is canonical; dead axis |
| `s32 *tab = D_80049370` shared base in case 0x28 | shared address web | `worse` (194/257) | population +15 in b2 (reload/move noise) |
| `s32 bf48 = (&D_8006BF48)[0]` local | BF48 element local | `worse` (188/242) | population +13, b2 13/16/26 |
| `s32 src = D_8005E54C` at function scope, used in 0x1E/0x32 call arg4 | shared src web, no per-case loads | `worse` (213/259) | pop +4: b0 1/0/1, b3 1/4/5, b6/b8 each 1/3/… — one shared load + one reload per case replaces two single loads |
| case 0x28: move `D_8005E538 = 0` to first statement | E538 store birth earlier | `worse` (215/260) | b2 sched 5→8, alloc 19→21, no pop change |
| case 0xA: `s32 vab = D_8005E544` local for store + SsVabOpenHead | vab web multi-use | `worse` (217/261) | b3 sched 1→4, alloc 2; pop exact, no copy removed |
| case 0x1E: pass `src` (= shared E54C load) instead of inline to `func_800215EC` | arg4 source | `identical` | CSE merges it — dead axis |
| case 0x1E: pass `value` to `func_800215EC` (provenance probe) | arg4 source | `worse` (216/260) | pop +1, b7 1/2/1 — the E54C provenance is confirmed exact |
| case 0x28 + 0xA: hoisted `idx`/`src` locals, fused len/diff via shared loads | shared index+src webs | `worse` (198/263) | pop +8: b0 3/2/1, b2 2/4/22, b13 3/0/0 |
| case 0xA: `D_8005E538 = 0x3C` moved before the store/call | li 60 out of copy chain | `worse` (219/260) | b3 sched 1→4, alloc 2; pop exact |

Net: **zero net improvements; the baseline 220/263 remains the best state**
and is left in `src/`. The tested lever space (index temps, shared 49370
base, shared E54C src, E538-store birth, vab local, 215EC arg
provenance, fused statement webs) is exhausted for blocks 2/6/8, and the
case-0xA `move a2,a3` coalescing is unchanged by every case-0xA variant.

Open reading for the next session: the allocation branch point sits in the
local-alloc quantity order/priorities for the base-address webs (49370,
BF48, C028/C068/BFA8), which is pinned by the RTL LUIDs and the sched1
order together. The one sched1 difference the log shows (E54C load early
vs late) is the leading candidate for the live-range change that flips
those priorities, but no tested source shape moves it: the load is
single-set (promoted) in every form tried, and expand_call's
argument-setup RTL order (E54C load, stack store, `li 9`, copies) appears
internal to this compiler. Remaining untested mechanisms: a compiler-
source-level check of `expand_call`'s PARM ordering (to confirm the
order is not source-controllable), and the instrumented local-alloc
oracle (`psx_solve_local_allocation`) to see which quantity-priority
vector would put the 49370 base in $v1 — a specification for a shape, not
a solution by itself.

## Fifth session — partial value merge clears cases 0x1E/0x32 (2026-08-17)

Resume from 220/263 (79.4%). Pipeline-reversal classified the residual as
sched 6 / alloc 30, blocks 2, 3, 6, 8, owner greg/allocation. Global allocno
order already exact (only s0/v1/s2 => 3 allocnos); every remaining difference
is local-alloc quantity formation/order over identical webs (lreg population
exact modulo the one block-3 copy).

**Breakthrough:** promoting the case-0x1E/0x32 index into ONE function-scoped
`value` local assigned in BOTH case bodies (a single two-set/multi-death web)
cleared both blocks outright: [0,0,6,30] -> [0,0,2,16] (249/274 exact words).
Prior sessions tried the *full* function-scope merge (forced $s2, frame grew)
or inline form (reload after the call); the 0x1E+0x32-only partial is the
first form to give the target's `$s0`-in-both-arms web. The multiple defs make
the value a global allocno the allocator places in $s0 because it spans the
func_80014988 call in the 0x1E arm — and the sibling 0x32 arm inherits $s0.

**Remaining residual: [0,0,2,16], blocks 2 and 3 only.**
- Block 3 (case 0xA, 1 sched + 1 alloc + 1 copy): the E544 value web — target
  $a2 (copy coalesced away), candidate $a3 + `move a2,a3`. Local-alloc oracle
  (fresh run e4746539685bd0de) confirms 233:$a2 is REJECTED: $a2 is statically
  live in the value's window because the sched1 order emits the arg-copy inside
  it (store wins the pre-call slot on the REG_DEP_ANTI class tie). Same
  instrumentally-proven-blocked conclusion as prior sessions.
- Block 2 (case 0x28, 1 sched + 14 alloc): the second-half base-address webs
  (C068/BFA8/E548/E560<<2/BF88-chain) cascade off a quantity-order swap between
  the BFA8 base (qty19, $a1) and the BF88-chain (qty20, $a2); target has them
  $a2/$a1 with C068-base $a3. Drives the whole second-half rotation.

**Measured this session (each compiled + scored):**
| Variant | Verdict |
|---|---|
| 0x1E+0x32 value merge (this win) | better — kept ([0,0,2,16]) |
| case 0x28 `cur` = E548 two-set local | worse ([0,1,19,12]) |
| case 0x28 split-h (BF88 result local) | worse ([0,0,5,22]) |
| case 0xA named `len` | identical (CSE merged) |
| -fno-schedule-insns2 (whole TU) | much worse (21 sched2 diffs in b2; target ran sched2) — flag closed |
| scheduler-state search block 3 sched | cannot derive a unique order assertion (copy/delay ambiguity) — closed |

**Closed this session:** statement order (block-3 copy is sched1-internal;
block-2 is quantity-order), two-set locals & split webs (regress block 2),
named-length (identical), per-file flags (no fingerprint; -no-sched2 regresses),
scheduler-state search (order assertion ambiguous), synthesizer (prologue-only
MVP cannot model the switch bodies), residual-source-search (3.9M domain; the
sampled class table only ever ADDED population; its grammar refuses the
base-pointer materialization form).

**Not yet run:** the FULL 3.9M residual-source-search exhaustion (~3h at 23
jobs) — no prior session ran it to completion either. The section axis (120 web
partitions) is the one place a quantity-formation change for blocks 2/3 could
still hide. Baseline left in src/ = [0,0,2,16].

## Resolution — byte-exact via three declaration/idiom truths (2026-08-17)

The "proven blocked" conclusions above were all correct *within the source's
own declarations* — and that was the trap. The residual [0,0,2,16] (block 2:
case 0x28; block 3: case 0xA) closed in one burst once the callee
declarations and the matched-sibling idiom were audited against ground truth:

1. **SsVabOpenHead takes 2 args, not 3** (`libsnd.h`:
   `short SsVabOpenHead(unsigned char*, short)`). The 3-arg prototype I had
   invented made GCC emit a phantom third-arg copy `(set a2, P)` — the exact
   instruction that lands inside the value web's live window, excludes $a2,
   and produced the "impossible" `move a2,a3`. The oracle rejection was an
   artifact of the wrong arity. Fixing the arity cleared case 0xA outright
   (count delta gone: 276 = 276).
2. **Base-pointer idiom for the second-half arrays**: `s32 *c028 =
   &D_8006C028; s32 *c068 = &D_8006C068; s32 *ba8 = &D_8006BFA8;` then
   index them — the exact idiom the matched sibling `func_80020818` uses for
   these arrays. Materializing the base quantities (which the inliner's CSE
   never created as allocatos) cleared all 14 of block 2's allocation
   differences: the bases take the target's $v0/$a3/$a2 instead of
   $v1/$t0/$a1.
3. **func_80021604 is void** (its definition TU declares `void`). My comment
   claimed its return value is stored to D_8006BFA8 — a misread of the
   delay-slot `sw v0,0(v1)`, which stores `head` (still in $v0). The phantom
   non-void return kept a $v0 return-web alive after the call, pushing
   `li 60` to $v1 instead of reusing $v0. Those were the last 2 bytes of the
   whole binary.

Also earlier this session: the partial 0x1E+0x32 `value` merge (one
function-scope local assigned in both case bodies) cleared blocks 6/8 and
took [0,0,6,30] → [0,0,2,16] — prior sessions had tried the *full* merge
(forced $s2, frame grew) or inline form (reload after the call), missing the
partial merge that reproduces the target's $s0-in-both-arms web.

Final: `psx_finalize_function` passed exact diff / full build / scope /
clean-source gates. `make check`: full payload byte-identical. The three
idioms are documented in the source comments.
