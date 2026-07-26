# func_8001E7DC — allocator preference battle: full tactics record

**Status: SOLVED in clean C (2026-07-26).** The matching source expresses each
component difference as one natural post-increment expression:
`delta = *arg0++ - *arg1++;`. This produces all 39 target instructions exactly,
with no register pins, barriers, or assembly. The allocator investigation below
was essential for locating the false constraint in the earlier reconstruction;
it is retained as a record of the mechanisms and the historical frontier.

Related: `notes/decompilation-retro.md` case C5 (original parking and resolution),
`notes/scratch/func_8001E7DC-candidate.c` (historical best candidate),
`notes/research/func_8001B4E4-scheduler-allocator-resolution.md` (sibling case study).

## 1. The function and the target

Bounds-check of two 3-element `s32` vectors against `±((D_8005E520>>1) + 0x258)`.
Caller (`func_8001E4C0`) passes `$a0 = sp+0x10`, `$a1 = sp+0x20`.

Target skeleton (39 insns):

```
move a2,a0          ; walk pointer copy — must survive as a REAL move
lw   a0,0(a1)       ; load temp -> $a0  (checks 1,2; check-3 boolean -> $a0 too)
addiu a1,a1,4
lw   v1,0(a2)       ; delta -> $v1
lw   v0,gp_rel(D_8005E520)(gp)
subu v1,v1,a0
sra  v0,v0,1 ; addiu a3,v0,0x258 ; negu t0,a3
slt/bnez ... addiu a2,a2,4 (delay slot) ; slt/beqz
... check 2 identical (walk increments on both $a1 and $a2) ...
lw   v0,0(a2)       ; check-3 arg0-load -> $v0 (local)
lw   v1,0(a1)       ; check-3 arg1-load -> $v1
subu v1,v0,v1
slt  a0,v1,t0       ; boolean -> $a0
slt  v0,a3,v1 ; li v0,1
```

## 2. Layer 1 — the CSE merge cascade (SOLVED)

**Symptom (old candidate):** with `s32 *a2 = arg0;` as the walk, cse1 folded the
whole walk into indexed loads on `$4` (`lw v1,4(a0)`), deleting copy + increments.

**Mechanism (cse.c, vendored refs in `notes/scratch/gcc-2.95.2-reference/`,
plus `cse.c` from gcc-mirror releases/gcc-2.95.2):**
- Processing `(set W (81))`, cse calls `insert_regs(W, classp, 1)` →
  `make_regs_eqv(W, 81)` whenever `lookup(canon_reg(81))` finds a class
  containing a REG of the same mode. **Any plain pseudo←pseudo copy merges.**
  The src reg does *not* need a known value — it only needs to be in the table.
- After merging, increments `(set W (plus W 4))` record W's value as
  `(plus 81 4)`, and later `(mem W)` addresses are substituted to
  `(mem (plus 81 4))` (equal cost → folded). Flow then deletes the copy and the
  increments as dead.
- **Fix: walk `arg0` directly.** Self-referential sets (`arg0 = arg0 + 4`) keep
  the pseudo's *address-form* uses opaque in practice: canon_reg(x) returns the
  first reg of the qty (the pseudo itself), so `(mem 81)` stays `(mem 81)`.
  Result: instruction selection/scheduling/delay slots match the target exactly.
- CAVEAT: self-ref sets do NOT remove the pseudo from cse's table. A *later*
  plain copy from that pseudo still merges (verified: the "delayed copy"
  variant `a2 = arg0` placed in check_y merged and cascaded identically).
- cse flushes its hash table only between *extended* basic blocks; check_y's
  label did not break the chain here.

## 3. Layer 2 — combine/regmove copy folding (mapped)

- **combine** folds a copy chain `(set 81 (reg 4))` + `(set W (81))` →
  `(set W (reg 4))` when 81 dies at the second copy (REG_DEAD note). It cannot
  fold when 81's last set is self-referential (substitution would leave 81
  referenced). Seen in dumps: combine output has `(set W (reg 4))`, insn 4 gone.
- **regmove** `optimize_reg_copy_1` only substitutes src uses *after* the copy;
  if src has none (dies at the copy) it does nothing. Not a threat here.
- Practical upshot: any "walk copy" either merges (cse) or folds to a
  `(set W (reg 4))` with a **copy-preference for `$4`** (see Layer 3).

## 4. Layer 3 — global-alloc mechanics (the real fight)

Vendored `global.c` + `local-alloc.c`; dumps via `compilerTrace.ts`.

### 4.1 Hard-register preferences
- `set_preference` (called from `mark_reg_store` in `global_conflicts`) records
  a copy/full preference for **any** `(set PSEUDO (reg H))` or `(set (reg H) PSEUDO)`.
  The entry arg copy `(set 81 (reg 4))` therefore gives the walk pseudo a
  **preference for `$4` that cannot be avoided** while the walk is arg0's pseudo.
- `expand_preferences`: for any `single_set` whose dest is an allocno and which
  has a REG_DEAD note for another allocno it does *not* conflict with, prefs
  merge **both ways** (copy-prefs only if the dead reg is the src). This is how
  a `$4` pref chains: walk `81` → dies in c3's `(set 87 (mem 81))` → `87` gets
  `{4}` → `87` dies in c3's `subu` → the subu's dest can inherit. Conflict
  between the two blocks the merge (a reg live at the other's birth conflicts).

### 4.2 Allocation order
- Priority: `floor_log2(refs) * refs * 10000 * size / live_length`,
  tie-break = allocno number (= pseudo creation order; arg pseudos first).
- `refs` = REG_N_REFS (flow, post-cse), `live_length` = REG_LIVE_LENGTH
  (flow's final propagate_block: +1 per insn where live, +1 per set — empirically
  sets count double; the two are *pinned by the final schedule* — statement
  reordering only moves them a little, see §5).
- `regs_used_so_far` is **initialized to all `call_used_regs`** (plus
  `regs_ever_live`), NOT empty. So find_reg's pass-0 offers all call-clobbered
  regs not conflicting/preferred-elsewhere; pass-0 usually succeeds.
- **Winner update:** when an allocno takes hard reg R, R is OR-ed into
  `hard_reg_conflicts` of every conflicting unallocated allocno. This is what
  makes later allocnos skip `$3`/`$5`, and what would neutralize the walk's
  `$4`-pref *if* a conflicting allocno took `$4` first.

### 4.3 `someone_prefers` — the poison
- `prune_preferences` (scanning low→high priority):
  `regs_someone_prefers[X] = ∪ (full_prefs of LOWER-priority conflicting
  allocnos) − full_prefs[X]` (self-prefs subtract out).
- find_reg pass-0 excludes `someone_prefers[X]`; pass-1 ignores it but only runs
  if pass-0 fails. Preference *override* stages also test against the pass-0
  `used` set.
- Consequence: if the walk (pref `$4`) is lower-priority than the load temp and
  conflicts with it, the load temp is blocked from `$4` in pass-0 → takes `$6`.
  If the walk is higher-priority, it takes `$4` itself (pref fires) and the move
  self-deletes (`move $4,$4` removed by `delete_noop_moves`).
  **This is the circular core of the problem.**

## 5. The tie, and the V2 breakthrough

Forward structure (walk `arg0` directly, separate `a0_val` load temp):
- walk 81: 8 refs / 26 live → `3*8/26*10000 = 9230`
- temp 83: 6 refs / 13 live → `2*6/13*10000 = 9230` — **exact tie**
  (`24/26 == 12/13`); tie-break puts 81 first → `$4` → move dies; temp → `$6`.
- refs are fixed by the final stream (T appears exactly 6×; walk exactly 8×).
- **V2 breakthrough:** placing the increments *before* the delta computation
  (`a0_val = arg1[0]; v1 = arg0[0]; arg0++; v1 = v1 - a0_val; arg1++;` in both
  checks) shrinks T's live-length **13 → 9** → priority **13333** — T allocated
  before 81. (Another variant with `arg1[-1]` loads also hit span 9.)
- But V2 then exposes the §4.3 poison: `someone_prefers[T] = {4,5}` → T → `$6`
  anyway, and 81 → `$4` (pref fires, `$4` free at its turn).

## 6. Historical frontier before the resolution

This section records the dead end as it was understood before the fused
expression was tested; §7 supersedes its assumptions.

For the target allocation (T→`$4`, walk81→`$6`) we need, simultaneously:
1. T allocated before 81 (V2's span trick achieves this), AND
2. T to actually take `$4` — requires `$4 ∉ someone_prefers[T]`, i.e. either
   - **T holds its own `$4` full-preference** (self-prefs subtract from
     `someone_prefers`), or
   - 81's `$4`-pref is absent/pruned (impossible for arg0's pseudo: entry copy
     is unavoidable, and hard `$4` never reappears in RTL to create a conflict).
   Then 81's pref is neutralized by the winner-update from T → 81 → `$6`.

**The only known way for T to get a `$4` pref** is the `expand_preferences`
chain: T must be the *dest* of a `single_set` in which a pref-`{4}` allocno dies
without conflicting. The pref-`{4}` holders are 81 (dies at c3's arg0-load) and
87 (c3 arg0-load temp, dies at c3's `subu`). So the candidate shapes are:
- c3's arg0-load destination = T → but target has that load in `$v0` ($2). ✗
- c3's `subu` output = T → target's c3 delta is in `$v1` ($3). ✗ at first glance
  — **but** if T held c3's delta *and* boolean while 86 (v1) only holds c1/c2
  deltas + c3 arg1-load... the c3 delta register would become `$4` ≠ target. ✗
- Make the c3 boolean's `slt` coincide with a pref-holder's death (86 dies at
  the *second* slt, not the first — reorder c3's checks? target order fixed). ✗

**Untried / open:**
- A c3 role reshuffle where T inherits `{4}` from 87 through a `single_set`
  whose dest is T and whose dying input is 87, *without* owning the delta —
  e.g. a Boolean computed *as* `(v0 - v1 < t0)` where the subexpression deaths
  line up differently. Needs ~4 concrete c3 shapes tested against the trace.
- Giving 87 (currently local, `$2`) a global role so its `{4}` pref can poison
  `someone_prefers[81]` — requires 87 to conflict with 81 (it doesn't: 81 dies
  at 87's birth).
- **Verified escape hatch if all fails:** P9 experiment proved the allocation
  *can* produce `move a2,a0` + walk `$6` — it just swapped delta/temp roles.

## 7. Resolution — eliminate the artificial persistent load-temp web

The breakthrough was to stop trying to make the persistent `a0_val` pseudo win
its global-allocation fight. That pseudo was an artifact of reconstructing the
assembly one statement at a time, not a requirement of the computation.
Writing each difference as the natural C expression:

```c
delta = *arg0++ - *arg1++;
```

lets GCC create separate, short-lived internal pseudos for the two loads. The
third component uses the corresponding non-incrementing form:

```c
delta = *arg0 - *arg1;
```

The complete matching structure is:

```c
delta = *arg0++ - *arg1++;
bound = (D_8005E520 >> 1) + 0x258;
lower = -bound;
/* bounds checks */
delta = *arg0++ - *arg1++;
/* bounds checks */
delta = *arg0 - *arg1;
/* bounds checks */
```

Result: **39/39 instructions, 100%, and `make check` byte-identical**.

### Why this works

The old reconstruction reused one user variable for all three right-hand-side
loads and the final Boolean. Flow therefore represented it as pseudo 83 with
three deaths, forcing it through global allocation. Its priority and inherited
preference interactions with the walking `arg0` pseudo created the circular
`someone_prefers` problem documented above.

The fused subtraction expression changes the RTL web structure completely:

- `delta` remains the only recurring user value web and is assigned `$v1`.
- Each component's operand load is a fresh single-set pseudo eligible for
  local allocation.
- The first two right-hand-side load pseudos naturally receive `$a0`.
- The walking `arg0` web receives `$a2`, preserving the entry `move a2,a0`.
- The post-increment side effects give the scheduler the dependencies needed
  to place both pointer increments exactly as in the target, including the
  branch delay slots.
- The third component's fresh operands naturally become `$v0` and `$v1`, and
  its comparison result becomes `$a0`.

The matching trace has 19 pseudos rather than the old candidate's 14. This is
the decisive inversion: **more fresh compiler temporaries produced the simpler
final allocation**, while the hand-shaped reusable temporary made the inverse
problem much harder.

### Why the prior research still mattered

The allocator work proved that the existing opcode stream and pointer-walk
shape were already correct, ruled out statement-order random walking, and
showed through P9 that the target entry move was attainable when value roles
changed. That evidence made it reasonable to remove the persistent temp web
instead of searching for increasingly elaborate ways to give it a `$4`
preference. The final source is therefore a direct consequence of the mapped
frontier, even though it sidesteps rather than defeats the preference battle.

## 8. Source shapes tested (all diffFunc/compilerTrace-verified)

| Shape | Result |
|---|---|
| old candidate (copy walk + separate temp) | cse cascade → indexed loads (2.6%) |
| **FORWARD (walk arg0 directly)** | **identical stream; 81→`$4`, T→`$6` (tie lost)** |
| REVERSE (`a2=arg0`, arg0 reused as load temp) | combine folds chain, walk gets `$4`-pref → same output as FORWARD |
| delayed copy (`a2=arg0` in check_y) | cse merges copy (81 still in table) → cascade |
| T-first creation order | same cascade |
| bound-first | spans unchanged |
| c3 load swap (`v1=arg1[0]` first) | scheduler keeps RTL order → output mismatch; spans unchanged |
| **V2 (incs before delta)** | **T span 13→9, pri 13333 — tie BEATEN; blocked by someone_prefers** |
| P9 (T also loads c3's arg1[0], 8 refs) | **walk→`$6` + `move a2,a0` achieved**; but delta↔temp roles swapped vs target |
| dead store `v0 = a0_val` | deleted before flow counts refs — no ref gain |
| `register` keyword ideas | not tested; unnecessary |
| **fused `delta = *arg0++ - *arg1++`** | **39/39, 100%; fresh local operand pseudos dissolve the global-allocation deadlock** |

## 9. Reusable tactics for other allocation fights

1. **Diff anatomy first:** if the instruction stream matches except register
   names, do NOT touch statement order — it's an allocator problem; go read
   `global.c`/`local-alloc.c`, not the source.
2. **The compilerTrace trio:** `uses/span/sets` per pseudo + the greg dump's
   `conflicts:`/`preferences:` lines + `;; N regs to allocate:` (the post-qsort
   allocno order) tell you 90% of the allocator's decision.
3. **Copy preferences are the usual villain** for arg-copy moves that vanish or
   materialize: any `(set P (reg H))` gives P a pref for H.
4. **Tie arithmetic:** compute `floor_log2(refs)*refs/live_length` by hand; ties
   break by pseudo creation order. refs are fixed by the final stream;
   live_length can shift ±4 with increment placement (V2).
5. **`someone_prefers` poisons pass-0:** when a lower-priority *conflicting*
   allocno prefers a reg, your target allocno can't take it in pass-0. Self-prefs
   subtract — so to claim a reg, sometimes you must *inherit* its preference via
   a dying-input merge (`expand_preferences`).
6. **Winner updates** (`hard_reg_conflicts += winner's reg` for conflictors) are
   how you *defend* a reg for a later allocno.
7. **cse merges any pseudo←pseudo copy** whose src is in the table; walking a
   parameter directly avoids it (self-ref sets), delayed copies do not.
8. Experiments are cheap and exact: diffFunc for the oracle, compilerTrace for
   spans/prefs/conflicts. Ten minutes of dump reading beats an hour of guessing.
9. **Question whether a difficult reusable web belongs in the original source.**
   Assembly-shaped temporaries often turn fresh expression operands into one
   multi-death global pseudo. Fuse the natural operation (`*p++ - *q++` here)
   and let expand create short-lived local pseudos before trying to manipulate
   allocator preferences.
