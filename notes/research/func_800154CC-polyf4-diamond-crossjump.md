# func_800154CC: POLY_F4 initializer — crossjump, register-web reuse, and the sched2 solution

**Date:** 2026-07-26; solved 2026-07-27
**Status:** `src/func_800154CC.c` is **50/50 (100%)**, clean C89 — no register
pins, barriers, flag overrides, or assembly stubs. `diffFunc` is exact and
`make check` confirms that `build/slus_011.bin` matches the original payload.

This note documents: what the function is; the `jump.c` transformation that
destroyed the target's if/else diamond and the clean crossjump shape that
defeats it; the GCC 2.95.2 scheduling/allocation feedback loop behind the final
four-instruction mismatch; the two-set `$v1` web and branch-join mask birth
that solved it; the same-input real-ASPSX boundary proof; failed experiments;
and reusable tooling and matching lessons.

---

## 1. The function and its family

`func_800154CC` is a **PSY-Q `POLY_F4` primitive initializer** (0xC8 bytes):

```
setlen(p, 5);                    /* sb v0,3(t0)   — tag.len = 5   */
setcode(p, 0x28);                /* sb v0,7(t0)   — POLY_F4 code  */
setRGB0(p, color>>16, color>>8, color);
p->code = semi ? 0x2A : 0x28;    /* semitransparent variant        */
p->x0=x; p->y0=y; p->x1=x+w; p->y1=y;
p->x2=x; p->y2=y+h; p->x3=x+w; p->y3=y+h;
addPrim(ot, p);                  /* tag addr linking, 0xFF000000/0xFFFFFF masks */
return p + 0x18;                 /* sizeof(POLY_F4)                */
```

Struct (0x18 bytes): `s32 tag` (offset 0), `s8 r/g/b/code` (4–7),
`s16 x0,y0,x1,y1,x2,y2,x3,y3` (8–0x16). The `0xFF000000`/`0xFFFFFF`
word ops at the end are exactly PSY-Q `addPrim(ot,p)` =
`setaddr(p, getaddr(ot)), setaddr(ot, p)` (24-bit addr + 8-bit len in the
tag word).

**Sibling family** (all still embedded asm — decompile them with this
note's pattern):

| Function | Primitive | Code | Notes |
|---|---|---|---|
| `func_8001526C` | small prim | 0x68 (len 2) | matched via asm |
| `func_8001530C` | small prim | 0x40 (len 3) | matched via asm |
| `func_800153BC` | POLY_G4 | 0x38 | same diamond + vertex sums |
| **`func_800154CC`** | **POLY_F4** | **0x28** | **this function** |
| `func_80015594` | TILE | 0x60 | immediately after (+0xC8) |

All of them share the same conditional-code diamond (`beqz / j+li / li /
sb v0,7` twice — first store + conditional store).

---

## 2. The diamond collapse (the big win: 30% → 92%)

### 2.1 The target's shape

```
lh  v0, 0x1c(sp)        # arg7 (semitrans flag)
beqz v0, .Lelse         # arg7 == 0 → else
 sra  a3, a3, 16         # (delay slot)
j .Ljoin
 li  v0, 0x2A            # (delay slot) — taken path value
.Lelse:
 li  v0, 0x28
.Ljoin:
 sb  v0, 7(t0)           # ONE store at the merge
```

An **uncollapsed** if/else diamond: both branches load a constant into the
same register, and one store after the join uses it.

### 2.2 What GCC 2.95.2 does to a natural source

For `p->code = (semi != 0) ? 0x2A : 0x28;` or the equivalent single-store
if/else, **jump.c (GCC 2.95.2, line ~449)** fires:

```c
/* Simplify   if (...) x = a; else x = b; by converting it
   to         x = b; if (...) x = a;  */
```

It hoists the else-branch constant before the conditional jump, deletes
the goto, and redirects the condjump — producing `li t2,40` in the
prologue, `beqz; li t2,42; sb t2,7(t0)` — a completely different shape.
The sibling transform at line ~592 (`if (...) {x = a; goto l;} x = b;`)
fires when the branches are swapped (hoists 42 instead).

**Gating conditions (both transforms):** the insn before the goto (temp3)
and the insn at the else label (temp2) must be `single_set`s to the *same
register* (`GET_CODE (temp1) == REG`), the else block must contain exactly
one insn (`no_labels_between_p`), and temp2 must have no disqualifying
REG_NOTES. `invert_jump` must succeed.

**jump_optimize's dead-reg sweep (jump.c line 277):** at the start of the
first jump pass (with `after_regscan`), it deletes any insn that sets a
pseudo whose first *and* last use is that same insn. Any write-once
dummy-variable blocker dies *before* the diamond transforms run.
`delete_trivially_dead_insns` then runs after cse (toplev.c line 3873)
and jump_optimize #2 (line 3876) re-collapses anything the sweep exposed.
The final jump_optimize #3 (line 4307) runs with `JUMP_CROSS_JUMP`.

### 2.3 The clean-C defeat: the crossjump two-store branch

Store the code byte **in both branches through a shared variable**:

```c
s32 var_v0;
if (arg7 != 0) {
    var_v0 = 0x2A;
    arg0->field_7 = (s8)var_v0;
} else {
    var_v0 = 0x28;
    arg0->field_7 = (s8)var_v0;
}
```

Mechanism, pass by pass:

1. **jump #1/#2:** both 449 and 592 are blocked because the insn before
   the goto (temp3) and at the else label (temp2) are `set (mem …)`, not
   `REG` destinations — `GET_CODE (temp1) == REG` fails. The diamond
   survives with two stores.
2. **crossjump (jump #3, runs before dbr):** the two `sb` insns are
   *identical* (same pseudo `var_v0`), so `do_cross_jump` merges the
   identical tails into a single store at the join label. Direct
   constants (`p->code = 0x2A` / `= 0x28`) would NOT merge — the stores
   differ — so the shared variable is essential.
3. **dbr:** with `li v0,42` adjacent to the goto, dbr steals it into the
   jump's delay slot — exactly the target's `j .L / li v0,42`.

This single shape change fixed *all* of: the `li t2,40` prologue hoist,
the mask-vs-store ordering, and the byte-extraction `v0`/`v1` swap.
**30/50 → 43/50 → 46/50 in pure C.**

### 2.4 Why not a barrier? (documented dead end)

A zero-instruction barrier in the else block also blocks 449/592 (43/50),
but it sits in block 2 and — via EBB interblock scheduling with its
memory-clobber dependency (or merely its presence as an extra insn) —
delays the merge `sb` so the mask-constant pair (`lui/ori 0xFFFFFF`)
floats above it. Every barrier form tested produced the same 43/50:
plain `__asm__ volatile("")`, `::: "memory"` before the set, operand
barriers (`"=r"(v) : "0"(v)` — which also distorted `var_v0`'s web to
1/50 and 35/50), input-only barrier. The barrier after the else set lets
592 fire (inverted `li t2,42` hoist → 1/50). The crossjump shape needs no
barrier at all.

---

## 3. The former remaining diff: the y+h sum bubble (offsets 0x68–0x74)

```
target:  addu v1,a2,v1   addu v0,a3,a1   sh v1,12(t0)   sh v1,20(t0)
ours:    addu v0,a2,v1   sh v0,12(t0)   sh v0,20(t0)   addu v0,a3,a1
```

`x+w` should inherit `v1` (arg4's freed register) and `y+h` should be
computed in `v0` immediately after `x+w`, before the two `x+w` stores.
Everything else in the function matches exactly.

### 3.1 Confirmed mechanism chain at 46/50

1. **sched1 (pre-allocation list scheduler) bubbles the y+h add down.**
   In `.regmove` the two adds are adjacent (both born before the x-stores);
   in `.sched` the y+h add sits after the arg-stores (position ~7–10 vs
   the target's 5). The scheduler output is **invariant to all source
   statement reorderings** (12 permutations compiled identically) — only
   the dependency DAG matters.
2. **Because the adds are separated in sched1's order, the sums'
   lifetimes are disjoint → local-alloc gives both `v0`.** The conflict
   sets in the `.lreg` dump show no 104↔105 conflict.
3. **Overlapping lifetimes were one demonstrated route to the target split.**
   local-alloc assigns quantities in *decreasing* length of life (longer first;
   `QTY_CMP_PRI = floor_log2(n_refs) * n_refs * size / (death - birth)`,
   ties by qty number). With adjacent adds: `y+h` (pseudo 104, longer
   span) → `v0` first; then `x+w` (105) finds `v0` occupied during its
   window and takes `v1` — exactly arg4's register, freed when arg4 dies
   at the add. The final solution found a cleaner second route: make x+w
   part of a traced multi-set global `$v1` web (§3.6), so sched1 adjacency
   is no longer required.
4. **The fake-lifetime escape hatch needs ±1.** With
   `-fschedule-insns2`, local-alloc first tries `fake_birth/death`
   (lifetime extended ~1 instruction each side; local-alloc.c line ~1433).
   If the y+h add were within ~1 instruction of the `x+w` store in
   sched1's order, the fake window would conflict and force the split.
   It is 2–4 positions too late.

### 3.2 Scheduler facts established (GCC 2.95.2 `sched.c`)

- Forward list scheduler; initial ready list = insns with
  `INSN_REF_COUNT == 0` (no predecessors). Block-end jumps/uses get
  `TAIL_PRIORITY` and anti-dependencies are added from the tail to every
  initially-ready insn (`INSN_REF_COUNT = 1`).
- Priority: `priority(x) = max over successors of (priority(succ) +
  insn_cost(succ, link, x) - 1`, min 1 — so unit-cost chains are all
  priority 1; only load-latency links (`result_ready_cost = 2` for loads
  on R3000) elevate (the addPrim tail chains reach 2–3).
- `rank_for_schedule` ties: class-on-`last_scheduled_insn`
  (cost-1-dependent = class 3 preferred), then `INSN_LUID`.
- `adjust_priority` birthing boost: a newly-ready insn whose dest is a
  live single-set pseudo gets `INSN_PRIORITY = max_priority` (max of
  ready[0] and the just-scheduled insn). Boosted values observed in the
  wild: the tag load (`lw`) and the mask2 `lui` (both birthing) jump to
  2–3 when they become ready during the elevated-priority tail phase.
- `schedule_select`: within a tied priority group, prefer the largest
  `potential_hazard` — memory-unit insns over ALU (`potential_hazard`
  keys on `function_units[unit].max_blockage > 1`; the "memory" unit on
  R3000 has max_blockage 2 from loads).
- MIPS `ADJUST_COST` zeroes anti/output dependence cost; data deps keep
  the producer's `result_ready_cost`.
- Each coordinate store has `ref_count 3`: the base reg, its input reg,
  and — because `arg1` (`s32 *`) may-alias `arg0` (struct) — **every
  `*arg1` memory op depends on all coordinate stores** (the two `*arg1`
  loads and the `*arg1` write). These anti-dependencies drive the
  tail-phase/elevated-priority structure of the whole block.

### 3.3 The wall experiment (partial proof)

`__asm__ volatile("" :: "r"(temp_v1), "r"(temp_v0) : "memory");` between
the adds and the x-stores pins the adds adjacent (input dependency pins
them before the wall; the clobber pins the stores after). The adds *do*
come out adjacent (24/25) and the sums split `v0`/`v1` — but the wall
scrambles everything else: store order flips (y-stores first), the
arg-load registers change (`arg4→a0`, `arg5→v1`), the mask pair drops to
26/27, net **36/50**. A second wall made it worse (34/50). This proved the
lifetime-overlap mechanism, but its register-web collateral made it unsuitable;
the 46/50 crossjump-only source remained the best state until the later
multi-set `$v1` solution.

### 3.4 explainDiff's hint

The classifier reported "2 reordered pairs appear **register-independent**"
— consistent with the case-study lever "fix the registers and the
schedule fixes itself": sched2 could not move the y+h add above
`sh12/sh14` because of a hard WAR on `v0` (stores read `v0`, the add
writes `v0`). With the correct `v1`-for-`x+w` split, the WAR disappears.

### 3.5 Ruling out the assembler boundary

The ordering-only signature made a maspsx/ASPSX difference plausible. This
was tested with the exact same cc1 assembly, not two independently compiled
inputs:

1. preserve `build/compilerTrace/func_800154CC/func_800154CC.s`;
2. convert it to CRLF, which real ASPSX requires;
3. run PsyQ 4.3's real **ASPSX 2.77** under a 32-bit Wine prefix;
4. parse the resulting PsyQ LNK object and extract its `.text` bytes;
5. compare the real-ASPSX instruction order with maspsx/GNU as and the target.

Real ASPSX emitted the same wrong candidate sequence:

```text
addu v0,a2,v1
sh   v0,12(t0)
sh   v0,20(t0)
addu v0,a3,a1
```

It did not move y+h above the stores. Therefore this was not an assembler
emulation gap; the search correctly returned to the C/cc1 register web.

### 3.6 The decisive clue: target `$v1` recurs later

The target uses `$v1` for two non-overlapping semantic results:

```text
addu v1,a2,v1       x+w
...
or   v1,v1,v0       first addPrim tag result
```

The 46/50 source used one local only for x+w and expressed the first tag merge
inline, creating separate pseudos. Reusing `temp_v1` for both values produced
the required old-GCC web:

```c
temp_v1 = arg2 + arg4;
/* Store x+w at fields C and 14. */
...
temp_v1 = (*(s32 *)arg0 & 0xFF000000) | (*arg1 & mask);
*(s32 *)arg0 = temp_v1;
```

The final compiler trace identifies this as pseudo 106:

```text
uses=5, sets=2, dies in 2 places, assigned v1, global/reload
```

This deliberately multi-set, multi-death user-variable web is the opposite of
the usual fresh-short-lived-pseudo lever, but it matches the target's hard
register recurrence. The x+w result is now `$v1`; y+h remains a local `$v0`
quantity.

Crucially, sched1 still bubbles y+h below the coordinate stores in the matched
source. The solution does **not** force sched1 to reproduce the target order.
Instead, allocation gives x+w `$v1`, removing the hard `$v0` WAR between the
x+w stores and the y+h add. sched2 can then move y+h above those stores and
produce:

```text
addu v1,a2,v1
addu v0,a3,a1
sh   v1,12(t0)
sh   v1,20(t0)
```

The intermediate tag-reuse variant reached **47/50**. All register roles and
sum/store positions were correct, but the mask pair moved after x+w:

```text
ours:    addu v1,a2,v1   lui a0,0xff   ori a0,a0,0xffff   addu v0,a3,a1
target:  lui a0,0xff     ori a0,a0,0xffff   addu v1,a2,v1   addu v0,a3,a1
```

### 3.7 The final lever: materialize the mask at the branch join

The final source names the shared 24-bit address mask and assigns it
immediately after the crossjumped branch join:

```c
if (arg7 != 0) {
    var_v0 = 0x2A;
    arg0->field_7 = (s8)var_v0;
} else {
    var_v0 = 0x28;
    arg0->field_7 = (s8)var_v0;
}
mask = 0xFFFFFF;
temp_v1 = arg2 + arg4;
temp_v0 = arg3 + arg5;
```

Both tag expressions then use `mask`. This gives the mask pseudo the required
birth site at the control-flow join and schedules its two-instruction
materialization before the sums. Placement was decisive:

| Mask source placement | Score | Effect |
|---|---:|---|
| before the branch | 0/50 | mask lifetime perturbs the prologue and branch allocation |
| after the sums | 47/50 | same x+w-before-mask order as the tag-reuse variant |
| **immediately after the branch join** | **50/50** | target `lui/ori`, x+w, y+h order |

The final core is exactly:

```text
lui  a0,0xff
ori  a0,a0,0xffff
addu v1,a2,v1
addu v0,a3,a1
sh   v1,12(t0)
sh   v1,20(t0)
```

### 3.8 Final clean-C shape and verification

The two non-obvious source mechanisms are therefore:

1. the branch-local two-store/shared-variable shape, merged later by
   crossjump; and
2. a named mask born at the join plus reuse of `temp_v1` for two distant
   target-`$v1` results.

Verification after promotion:

```text
psx_diff_function func_800154CC: 50/50 instructions (100.0%)
psx_verify_build: build/slus_011.bin matches original payload
```

Context export added the function signature and `Struct_800154CC` to the
generated function context header. A separate finalizer scope-path issue is
not a source, compiler, or binary-match failure.

---

## 4. Failed experiments (all against the same 50-instruction target)

| # | Shape | Score | Mechanism / why it failed |
|---|---|---|---|
| a | ternary `p->code = c ? 0x2A : 0x28` | 30/50 | jump.c 449 collapses the diamond, hoists `li t2,40` |
| b | if/else, single store after merge | 30/50 | same |
| c | swapped condition (`== 0` first) | 1/50 | jump.c 592 inverted hoist (`li t2,42`) |
| d | arithmetic `0x28 + ((c!=0) << 1)` | 30/50 | folds to the same diamond, collapses |
| e | `switch (arg7)` | 1/50 | compiles to the same diamond, collapses |
| f | write-once dummy in branch | 1/50 | jump.c line 277 reg-scan sweep deletes it pre-transform |
| g | dummy pair (`d = v; d = d+1`) | 1/50 | survives jump #1, dies at `delete_trivially_dead_insns`, jump #2 collapses |
| h | memory barrier, else block, before set | 43/50 | blocks collapse but EBB delay: mask floats above `sb` |
| i | memory barrier, else block, after set | 1/50 | 592 fires |
| j | operand barrier `"=r"(var_v0)` | 1–35/50 | distorts `var_v0`'s web (3 sets) |
| k | input-only barrier `:: "r"(arg6)` | 43/50 | same as (h) |
| l | PSY-Q `P_TAG` bitfields (`addr:24`) | 43/50 | combine reduces to identical RTL |
| m | **crossjump two-store (WINNER)** | **46/50** | §2.3 |
| n | m + statement permutations (12) | 46/50 | scheduler is DAG-invariant |
| o | coords via `s16 *` pointer | 29/50 | extra `addiu` for the pointer |
| p | asm wall (reads sums + clobber) | 36/50 | §3.3 |
| q | two walls | 34/50 | worse cascade |
| r | addPrim part 1 moved mid-block | 26/50 | `arg1` register breaks (`t1→t2`) |
| s | addPrim part 1 right after merge store | 27/50 | same |
| t | reassign `s16 arg4` / `arg5` to hold sums | 1–10/50 | narrowing assignment adds `sll/sra` truncation and perturbs argument loads |
| u | `temp_v1 = arg4; temp_v1 += arg2` | 46/50 | combine removes the copy; only commutative operand order changes |
| v | reuse sum temps for color extraction | 28–39/50 | long global webs seize early registers and disturb the prologue |
| w | reuse both sum temps for later tag results | 45/50 | correct broad idea, but y-web reuse changes `arg5` allocation |
| x | **reuse x temp for first tag result** | **47/50** | x+w becomes the target `$v1` web; sched2 fixes y+h, mask pair is late |
| y | x-tag reuse + mask before branch | 0/50 | mask is born too early and perturbs the whole block |
| z | x-tag reuse + mask after sums | 47/50 | mask birth remains too late |
| aa | **x-tag reuse + mask at branch join** | **50/50** | final clean-C match (§3.6–3.8) |

All scores via `psx_fuzz_variants` in full mode (cc1 → maspsx → as → objdump).

---

## 5. Reusable levers for this family and future fights

1. **The crossjump two-store idiom.** For any target showing
   `beqz / j+liA / liB / sb v0,off` (both branches constant-loading the
   same register, one merge store), write the store in both branches
   through one shared variable. jump.c can't collapse it (MEM dest), and
   crossjump merges the identical stores at the join. Apply to
   `func_8001526C`, `func_8001530C`, `func_800153BC`, `func_80015594`,
   and any other primitive-init helper when decompiling them.
2. **jump.c is the branch-shape authority.** The 449/592 "if/else
   constant hoist" transforms are in vendored
   `notes/scratch/gcc-2.95.2-reference/jump.c` (added during this
   research, from ftp.gnu.org gcc-2.95.2.tar.gz — full tree remains at
   `/tmp/gcc-2.95.2/`). Their exact gating conditions (single REG set,
   one-insn else block, `no_labels_between_p`, REG_NOTES exceptions) tell
   you precisely which source structures are safe.
3. **Dead-statement blockers have a lifetime wall.** jump_optimize's
   reg-scan sweep (jump.c:277) kills write-once pseudos before the
   transforms; `delete_trivially_dead_insns` kills chains after cse, then
   jump #2 and #3 re-run. Anything meant to block a jump transform must
   survive *all* jump passes — only volatile asms and referenced labels
   qualify.
4. **EBB memory-clobber delay.** A volatile asm with a memory clobber in
   a predecessor block delays that block's dependent memory ops in
   interblock scheduling, letting independent constants (lui/ori) float
   above them. Avoid barriers as scheduling fixes for store/constant
   ordering issues.
5. **Scheduler outputs are statement-order invariant.** All permutations
   of independent statements compiled identically — the list scheduler's
   DAG + tiebreaks decide everything. If the order is wrong, the DAG
   (instruction set, dependencies, pseudo webs) must change, not the
   source text order.
6. **local-alloc order: decreasing length of life.** Longer-lived
   quantities get registers first; a shorter-lived quantity born where an
   argument register dies inherits that register *only if* the
   longer-lived quantity occupying `v0` was allocated first. Count
   pseudo numbers and spans before predicting a register race.
7. **`±1` fake-lifetime conflicts.** With `-fschedule-insns2`, register
   splits between two webs can hinge on a single instruction of distance
   in sched1's order. When two values share a register that the target
   splits, measure their birth/death distance in the `.sched` dump, not
   the final asm.
8. **Search target hard-register recurrence across the whole function.** If
   two non-overlapping target values use the same hard register while the
   candidate gives them fresh pseudos, test whether one C variable originally
   carried both. In this case x+w and the later first tag OR both use `$v1`.
9. **A sched1 mismatch can be solved at allocation/sched2.** Do not assume the
   pass that first creates the wrong order must be changed. Giving x+w `$v1`
   removes the post-allocation `$v0` WAR and lets sched2 repair y+h.
10. **Multi-death webs are sometimes the target, not a smell.** Fresh operands
    remain the default, but a repeated target hard register can justify a
    deliberate user-variable reuse backed by trace evidence.
11. **Control-flow joins are meaningful birth sites.** Naming a shared constant
    immediately after a join can change scheduler LUID/lifetime behavior while
    preserving natural C. Before-branch and after-consumer placements are not
    equivalent experiments.
12. **Prove assembler gaps with identical input.** Real ASPSX and maspsx must
    receive the same cc1 assembly before assigning blame to the boundary.

## 6. Follow-up tooling and family work

- Plans derived from this solution now live at:
  - `plans/compiler-web-scheduler-diagnostics.md`;
  - `plans/aspsx-same-input-differential.md`;
  - `plans/mechanism-aware-variant-lab.md`.
- Decompile the sibling family with the crossjump idiom; `func_800153BC`
  (POLY_G4) has the same branch and sum structure and may benefit from the
  target-register-recurrence test.
- Extend `compilerTrace.ts` to expose exact quantity composition, pseudo
  provenance, scheduler DAG decisions, and allocation-to-sched2 hazards.
- Preserve complete hypothesis sources and pass-level divergence metadata in
  future `psx_fuzz_variants` runs.
- Automate the real-ASPSX same-input differential so a boundary hypothesis is
  one deterministic diagnostic rather than a manual Wine experiment.

---

*Sources: GCC 2.95.2 (jump.c, cse.c, sched.c, local-alloc.c, toplev.c,
mips.h/mips.md) — jump.c newly vendored at
`notes/scratch/gcc-2.95.2-reference/` during this research; full tree at
`/tmp/gcc-2.95.2/`. Target analysis from
`build/asm/nonmatchings/func_800154CC/func_800154CC.s` and `-da` pass
dumps under `build/compilerTrace/func_800154CC/`. The assembler-boundary test
used the identical cc1 `.s` with real PsyQ 4.3 ASPSX 2.77 under Wine and the
configured maspsx/GNU-as path.*
