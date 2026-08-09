# Shared user variable as a global allocno: conflict-driven register selection

**Date:** 2026-08-28
**Status:** SOLVED mechanism, byte-verified on func_80017E34 (27/27) and
consistent with the byte-identical loop in sibling func_80017EA0.
**Lookup symptoms:** a pure hard-register swap ($v0 <-> $v1) between two
same-shaped value webs; web parity OK; inventory empty; the swap survives
every expression-shape variant in the loop family; all variants compile to
identical RTL (same pseudos, same quantities) no matter how the statements
are phrased.

## The mechanism

A pseudo is local-allocatable only if it lives in one basic block and dies
once (gcc/local-alloc.c, `local_alloc`: `REG_BASIC_BLOCK (i) >= 0 &&
REG_N_DEATHS (i) == 1`). **A user variable set in two blocks is never a
local quantity — it is a global allocno**, and its hard register is chosen
by a completely different rule set than a local's:

- Locals: priority `floor_log2(refs)*refs*size/(death-birth)`, ties broken
  by birth order; first free register in REG_ALLOC_ORDER wins.
- Globals: `global_conflicts` resolves local-allocated pseudos through
  `reg_renumber` (gcc/global.c:663), so a global allocno **conflicts with
  the hard registers of locals whose live ranges overlap its own**, and
  `find_reg` takes the first already-used call-saved register that does
  not conflict.

Consequence: a shared variable's register is driven by **which locals
overlap its segments**, not by any priority tie. If a same-block constant
or temporary holds `$v0` across the variable's live window, the variable
gets `$v1` — in *every* block where it appears, because one allocno gets
one hard register.

## The fingerprint in the target

Read the target's register assignments as a census of the original's
variables before diffing against any candidate:

- The **same hard register serving the same role in two different blocks**
  (func_80017E34: `$v1` is both the pre-check re-read `lhu $v1,0($a1)` and
  the loop store-load `lhu $v1,0($a1)`) is positive evidence for **one
  shared user variable**, not two fused expression temporaries. Two
  independent locals could share the register by disjoint lifetimes, but
  when a same-register pattern reproduces across sibling functions in the
  TU (func_80017EA0 shows the identical loop coloring), prefer the shared-
  variable reading.
- A local constant whose window crosses the variable's compare (here the
  block-4 `0xFFFF` materialization, live from its `ori` to the `beq`) is
  what excludes `$v0` and forces `$v1`. Check that such an overlapping
  local exists; it is the conflict that makes the coloring deterministic
  rather than accidental.

## The stop condition this implies for tie-breaking searches

When a register swap is classified as a local-alloc tie and the tie is
**structurally forced** — both webs have equal refs (same loop depth,
same use count), equal lifetime windows (both pinned by the dependency
graph), and birth order fixed by must-precede edges — then *no source
shape inside the same expression family can break it*, because every
variant compiles to the same quantities. The correct response is not a
finer scheduler or allocator search inside the family; it is to **change
the web population**: make one of the swapped values a multi-block user
variable (or fuse it away entirely) so local allocation no longer decides
its register.

Cheap test for family exhaustion: compile two phrase-level variants and
diff the `.lreg` dumps (not the .s). Identical pseudo/quantity structure
means the family is one point in the search space; further permutations
of it are free of information.

## Verified application

func_80017E34 (u16 strcat, 27 insns): sat at 23/27 with the loop's
load/compare registers swapped. All do-while-family variants produced the
identical tie (verified: refs 4, window 4, priority 20000 each, birth-order
break). Writing the pre-check re-read and the loop store value as one
shared `u16 c;` made `c` a global allocno conflicting with the block-4
0xFFFF constant's `$v0`, so global-alloc assigned `$v1` in both blocks; the
loop compare re-read remained the only block-5 local and took `$v0`.
27/27 on the first compile of that shape, byte-verified through the full
gate. The same coloring in func_80017EA0's byte-identical loop should
yield to the same shape when that function is decompiled.
