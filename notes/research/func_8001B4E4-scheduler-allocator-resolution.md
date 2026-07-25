# Resolving func_8001B4E4: a case study in scheduler and allocator reverse-engineering

**Date:** 2026-07-25
**Outcome:** `src/func_8001B4E4.c` matches 19/19 instructions, `make check`
byte-identical, in 100% clean C89 — no register pins, no scheduling barriers,
no flag overrides. The function was previously one of three "parked" files
(decompilation-retro case C4) held together by six `register __asm__` pins and
three `__asm__ volatile("")` barriers.

This note documents the full research path: the mechanisms extracted from the
GCC 2.95.2 source, the strategies that failed (and exactly why), and the
three-ingredient source shape that finally matched. The levers at the end are
written to be reusable for the remaining parked functions and future
scheduling/allocation fights.

---

## 1. The problem

`func_8001B4E4(s32 arg0)` is a 19-instruction "clear slot" routine: zero two
bytes in a struct, one `s32` array element, and three `s16` array elements,
all indexed by `arg0`. The original binary:

```
lui   $v0, %hi(D_8005E870)       \
addiu $v0, $v0, %lo(D_8005E870)   |
sb    $zero, 0x36($v0)            | struct bytes
sb    $zero, 0x37($v0)           /
sll   $v0, $a0, 2                \
addiu $v1, $gp, %gp_rel(C8)       |
addu  $v0, $v0, $v1               | arr32[arg0]
sll   $a0, $a0, 1                 |
sw    $zero, 0($v0)              /
addiu $v0, $gp, %gp_rel(C4)      \
addu  $v0, $a0, $v0               |
addiu $v1, $gp, %gp_rel(D0)       | three s16 entries
addu  $v1, $a0, $v1               |
sh    $zero, 0($v0)               |
addiu $v0, $gp, %gp_rel(C0)       |
addu  $a0, $a0, $v0               |
sh    $zero, 0($v1)              /
jr    $ra
sh    $zero, 0($a0)
```

Two properties make it hard:

- **Perfectly sequential order.** Every store immediately follows its address
  computation. Our compiler's instruction scheduler, given any freedom,
  shuffles exactly this kind of block.
- **A register relay race.** `$v0` carries the struct pointer, then the shift
  result, then the C8 address, then the C4 base+address, then the C0 base.
  `$v1` and `$a0` have their own interleaved chains (note the alternating
  `$v0`/`$v1` pattern of the four `addiu $gp` address loads).

The decompilation playbook reduces to: find plain C that our compiler (proven
byte-identical to the original PSY-Q cc1) turns into *this* — same
instructions, same order, same registers.

## 2. Prior state and the failed hypothesis

The 2026-07 sweep (retro case C4) had established:

- Stripping the pins from the legacy file and restructuring to a **single
  reused pointer variable** reproduced the instruction *order* ~100%.
  Mechanism: a reused local variable gets one pseudo register; its WAR/WAW
  dependencies pin the scheduler.
- But the reused pointer's register web came out as `$v1` where the target
  has `$v0` — a single global allocation swap that six perturbation variants
  failed to flip. The sweep parked it as "allocation priority among
  conflicting webs is the one mechanism this sweep did not crack."

**This session proved the reused-variable hypothesis is not just stuck but
*provably wrong*.** The original source cannot have had that shape.

## 3. Method

1. **Toolchain evidence first.** `explainDiff.ts` (structural classifier),
   `diffFunc.ts` (exact oracle), `compilerTrace.ts` (GCC `-da` pass dumps:
   `.rtl`, `.sched`, `.lreg`, `.greg`, `.sched2`). The `.lreg`/`.greg` dumps
   expose per-pseudo lifetimes, death counts, conflict sets, and which pass
   assigned each register.
2. **Read the actual compiler source.** The vendored old-gcc tree has only
   binaries, so the exact GCC 2.95.2 `local-alloc.c` and `sched.c` were
   fetched (gcc-mirror, `releases/gcc-2.95.2` tag) and are now vendored at
   `notes/scratch/gcc-2.95.2-reference/`. Every mechanism below was confirmed
   against the source, not folklore.
3. **Family archaeology.** The original file's neighbors
   (`func_8001B4D0`, `func_8001B258`, the INCLUDE_ASM callers
   `func_8001B3CC`/`func_8001B3EC`) show the same `sll`/`addiu $gp`/`addu`
   idiom and the same `$v0`/`$v1` split, confirming the pattern is a natural
   outcome of this compiler in this codebase, not an exotic one.
4. **Controlled source experiments.** ~15 source shapes compiled and diffed,
   each chosen to test one mechanism (never random permutation).

## 4. Mechanisms extracted from GCC 2.95.2

### 4.1 local-alloc only handles values that die exactly once

`local-alloc.c` (`local_alloc`, ~line 365):

```c
if (REG_BASIC_BLOCK (i) >= 0 && REG_N_DEATHS (i) == 1 && ...)
    reg_qty[i] = -2;   /* eligible for local allocation */
else
    reg_qty[i] = -1;   /* falls through to global-alloc */
```

A reused variable (multiple disjoint live ranges) has `REG_N_DEATHS > 1` and
is *always* handled by global-alloc. Global-alloc sees the hard registers
already occupied by local-alloc quantities overlapping its live windows and
conservatively takes the next free one. For the candidate's `sp` pseudo:
locals had already claimed `$v0` at three points inside its windows, so `$v0`
was unavailable and it got `$v1`.

**Corollary (determinism argument):** same RTL + same compiler binary = same
output. Since the reused-variable RTL deterministically yields `$v1`, the
original function's RTL *cannot* have contained a reused pointer variable.
The scheduler-pinning benefit of variable reuse is real, but it guarantees
the wrong allocation. This is the trap the sweep walked into.

### 4.2 How local-alloc actually assigns registers

Per basic block (`block_alloc`), in order:

1. **Scan instructions, forming quantities (qtys).** When an instruction's
   output can share a register with an input that *dies* there,
   `combine_regs` merges them into one qty — this is what makes
   `addu $v0,$v0,$v1` reuse the shift result's register, and what makes
   `addu $a0,$a0,$v0` reuse `$a0`.
2. **Hard-register suggestions.** If a pseudo is set from a hard register, or
   born at an instruction where a hard register dies as an input, that hard
   register is recorded in `qty_phys_sugg`. Quantities with suggestions are
   allocated **first**, with their **true** lifetimes. (This is how `arg0`'s
   copy reliably lands in `$a0`, and — crucially for the solution — how a
   temp born from a dying hard `$a0` inherits `$a0`.)
3. **Priority order** for the rest:
   `floor_log2(n_refs) * n_refs * size / (death - birth)`, ties broken by
   qty number (i.e., birth order).
4. **Fake lifetimes.** With `-fschedule-insns2` (our flags), each qty is
   tested against a lifetime extended ±1 instruction on both sides
   (`local-alloc.c` ~line 1442) to discourage false dependencies; the true
   lifetime is the fallback. Meanwhile, already-allocated registers are
   marked live only over their *true* lifetimes (`post_mark_life`).

Working through this algorithm on paper for a **single-set-per-value** RTL
in target order reproduces the target allocation *exactly* — including the
alternating `$v0`/`$v1` symref loads (each `addiu $gp` is born while `$v0`
is still occupied by the previous address value, and vice versa). So the
allocator was never the real obstacle; it only needed the right RTL.

### 4.3 The pre-alloc scheduler is a backward list scheduler

`sched.c` schedules each block **backwards** (from the last instruction to
the first). All instructions in this function have priority 1, so ordering
is decided entirely by:

- **Ready-list dynamics.** An instruction becomes ready (in backward time)
  once everything that depends on it is scheduled; newly-ready instructions
  jump to the front.
- **A `potential_hazard` tie-break** (`sched.c` ~line 2082): among tied
  ready instructions, prefer the one with the largest function-unit blockage
  cost — a heuristic that favors memory-unit instructions over ALU ones.

With no dependencies, this scheduler does *not* preserve source order — it
bubbles independent chains through each other (shifts floated to the top of
the block, address loads above the struct-byte stores, the word store pushed
below the halfword address chains).

### 4.4 Store ordering comes from alias analysis, not from stores being stores

Stores to memory are only ordered against each other (memory output
dependencies) when alias analysis **cannot prove they don't alias**. GCC
2.95 tracks base values through cselib: `&D_8005E4C8 + off` and
`&D_8005E4C4 + off` have distinct symbol bases and are *provably* different
addresses — so stores through independently-computed pointers are mutually
unordered and the backward scheduler treats the whole block as reorderable.

The candidate's stores all went through the *same* reused pseudo, which
may-alias → output deps → order pinned. This is the second half of the trap:
**fresh pseudos allocate correctly but schedule chaotically; a reused pseudo
schedules perfectly but allocates wrongly.**

### 4.5 sched2 (post-allocation) and why one order flip was a symptom

The reused-variable candidate had exactly one final order glitch: the C4
address load moved above the word store. The traces show this happened in
**sched2**, after allocation, via the same `potential_hazard` pick. Under the
target's allocation it cannot happen: the C4 load writes `$v0`, which the
preceding `sw` reads — a hard-register WAR dependency. **Fix the registers
and the schedule fixes itself.** Allocation and scheduling were never two
problems; the order flip was downstream of the register swap.

## 5. Failed strategies (all against the same 19-instruction target)

| Variant | Shape | Result | Why it failed |
|---|---|---|---|
| Legacy file | 6 pins + 3 barriers | 100% | forbidden by project policy |
| Reused `sp` (scratch candidate) | one pointer variable for the whole chain | order ~100%, regs swapped | multi-death pseudo → global-alloc → `$v1` (§4.1) |
| A: fresh temps per value | single-set everything, `arg0 <<= 1` | 31.6% | no alias deps → backward scheduler bubbles everything (§4.3/4.4) |
| D: "natural" programmer form | `(&D_8005E4C8)[arg0] = 0;` etc. | 31.6% | same as A |
| F/G/J: statement permutations | E870 last / sw last / E870 mid | 5–42% | scheduler still free |
| H/I: interleaved / addresses-first | | 31.6% | same |
| K: `volatile` stores | volatile-qualified stores | 15.8% | volatile breaks address CSE and changes relocations |
| M: RMW chain `s4 += &C8` | read-modify-write C8 chain | 42.1% | addu output tied to the wrong operand; still no E870↔C8 pin |

Two structural findings fell out of these failures:

- **The `arg0 <<= 1` statement was poison in every variant.** It forces an
  entry copy of `arg0` into a pseudo (an extra instruction the target
  doesn't have — deleted later as a no-op move, but present in RTL and
  affecting the scheduler) plus an anti-dependency that participates in the
  backward scheduler's bubbling.
- **Operand order in `addu` is emission order.** For reg+reg `plus`, no
  regno canonicalization was observed; both the array-index form and the
  pointer-arithmetic form emit the scaled value first, matching the target.
  (Retro case C6's "address-arithmetic canonicalization" open problem should
  be re-read in this light.)

## 6. The resolution

The winning shape (`src/func_8001B4E4.c`):

```c
#include "common.h"

extern s32 D_8005E4C8;
extern s16 D_8005E4C4;
extern s16 D_8005E4D0;
extern s16 D_8005E4C0;

void func_8001B4E4(s32 arg0) {
    struct_8005E870 *ep;
    s32 *p32;
    s16 *p16a;
    s16 *p16b;
    s16 *p16c;
    s32 s4;

    ep = &D_8005E870;
    ep->field_36 = 0;
    ep->field_37 = 0;
    s4 = arg0 << 2;
    p32 = (s32 *)((char *)&D_8005E4C8 + s4);
    *p32 = 0;
    p16a = (s16 *)((char *)&D_8005E4C4 + (arg0 << 1));
    p16b = (s16 *)((char *)&D_8005E4D0 + (arg0 << 1));
    *p16a = 0;
    p16c = (s16 *)((char *)&D_8005E4C0 + (arg0 << 1));
    *p16b = 0;
    *p16c = 0;
}
```

Three ingredients, each addressing one mechanism:

1. **`arg0` is never re-assigned.** It therefore stays in hard `$a0` — no
   entry copy pseudo, no `arg0 <<= 1` statement. This removes the extra RTL
   instruction and the anti-dependency that let the backward scheduler bubble
   the shifts to the top of the block.
2. **The halfword index is written inline — `(arg0 << 1)` inside each s16
   address expression.** CSE merges the three into one shift, born at the
   first consuming statement (the retro's C3 "expression birth site" lever).
   That lands the `sll $a0,$a0,1` exactly at the target's position, and the
   temp inherits `$a0` through the dying-hard-register suggestion (§4.2.2),
   so the final `addu $a0,$a0,$v0` reuses it naturally.
3. **Everything else is single-set.** With every pseudo dying exactly once
   and RTL order equal to target order, the local-alloc cascade of §4.2
   reproduces the target's register webs exactly, and sched2 — now seeing
   the target's hard-register dependencies — keeps the order.

Result: **19/19 instructions, byte-identical binary, zero workarounds.**

## 7. Reusable levers (doctrine candidates)

1. **`REG_N_DEATHS == 1` is a hard constraint on source shape.** If the
   target shows a register carrying *independent* values, that is allocation
   reuse, not necessarily variable reuse. A reused C variable (multiple
   disjoint live ranges) is pushed to global-alloc and will almost never
   reproduce a tight local-alloc-looking register race. Before reaching for
   variable reuse as a scheduler pin, count the variable's deaths.
2. **Never re-assign a function argument that the target keeps in its
   incoming register.** Re-assignment forces an entry copy and reshapes both
   the scheduler's ready list and the allocator's suggestion table. Compute
   derived values in fresh temps or inline instead.
3. **Fuse shared subexpressions into their consuming statement** when the
   target shows the computed value born mid-block (C3 lever): the birth site
   drives both the scheduler position and the allocation cascade.
4. **A dying hard-register input donates its register** to the value being
   computed (`qty_phys_sugg`). If the target shows a temp inheriting `$a0`–
   `$a3`, arrange for the argument to die at that instruction (i.e., don't
   use the argument again afterwards).
5. **Store order is only pinned by may-alias or anti-dependencies.** Stores
   through provably-distinct symbol bases are freely reorderable by the
   backward scheduler; if the target keeps stores strictly sequential with
   independent address chains, look for an argument-death/RMW structure that
   supplies the missing dependencies — not variable reuse.
6. **Allocation first, scheduling second.** A post-allocation order glitch
   can be a symptom of a wrong register web (hard-register hazards change
   sched2's choices). Diagnose the allocation before treating order
   mismatches as scheduling problems.
7. **The compiler source is the ground truth for "uncrackable" allocation
   puzzles.** `local-alloc.c` and `sched.c` for 2.95.2 are vendored at
   `notes/scratch/gcc-2.95.2-reference/`; the eligibility rule, priority
   formula, tie-breaks, and fake-lifetime extension are all short reads and
   replace hours of source permutation.

## 8. Follow-ups

- Apply levers 2–4 to the remaining parked functions: `func_8001E7DC` (C5 —
  its whole shape follows from one load-result pseudo preferring `$a0`,
  exactly the suggestion mechanism) and `func_8001AF44` (C6 — operand order,
  cf. §5 finding on emission order).
- Teach `compilerTrace.ts` to report exact qty composition, suggestion sets,
  and fake-lifetime windows from the existing `-da` dumps (the model is now
  known; the tool still approximates).
- The retro's open question #1 (allocator priority model) is partially
  answered for local-alloc; global-alloc's ordering for genuinely
  multi-death webs remains unmodeled.

## References

- `notes/decompilation-retro.md` — case C4 (+ 2026-07-25 update marking the
  solution), C3 (birth-site lever), C5/C6 (remaining parked cases).
- `notes/scratch/gcc-2.95.2-reference/local-alloc.c`, `sched.c` — exact
  compiler sources used for the mechanism extraction.
- `notes/scratch/func_8001B4E4-candidate.c` — the dead-end reused-variable
  shape, kept with a warning header.
- `prompts/c-style-guide.md` — project pattern catalog.
