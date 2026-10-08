# ovl_11_func_8010D0EC — a case constant born in the entry block is a reused register

**Date:** 2026-10-08
**Outcome:** `ovl_11_func_8010D0EC` is EXACT under the residual oracle,
72/72 words, residual `[0, 0, 0, 0]`. `make check-all` passes. The previous
session's 80 ledger attempts had plateaued at 58/70, residual
`[cfg 0, pop 6, sched 1, alloc 5]`.

The fix was a value, not a spelling. The original indexes the offset table
`D_80124FCC` through a variable:

```c
index = 10;
offset = D_80124FCC[index];
```

CSE folds `index << 2` into a register holding 40. The `case 0x28` test then
reuses that register instead of loading its own constant. No arrangement of
the expressions already in the candidate could produce that register.

---

## 1. The symptom

Entry block, case-test block, and the read after the join (ABI register
names):

```asm
/* target */                         /* previous best (58/70) */
move  s1,a0                          move  s1,a0
lui   a1,%hi(D_80124FCC)             lui   a1,%hi(D_8007AFF0)
lui   a0,%hi(D_8007AFF0)             addiu v0,a1,%lo(D_8007AFF0)
addiu v0,a0,%lo(D_8007AFF0)          ...
...                                  lui   v1,%hi(D_80124FCC)
                                     move  a3,a1            # extra copy
lh    a2,0x5476(v0)                  lh    a2,0x5476(v0)
lw    v0,%lo(D_80124FCC)(a1)         lw    v0,%lo(D_80124FCC)(v1)
slti  v1,a2,7                        slti  a0,a2,7
lw    a1,0x28(v0)                    lw    a1,0x28(v0)
beqz  v1,.Lcase28                    beqz  a0,.Lcase28
 li   a3,0x28                         slti v0,a2,3
...
.Lcase28:                            .Lcase28:
bne   a2,a3,.Ldefault                li    v0,0x28
                                     bne   a2,v0,.Ldefault
...
.Ljoin:                              .Ljoin:
beq   a1,v0,.Lout                    beq   a1,v0,.Lout
 addiu v0,a0,%lo(D_8007AFF0)          addiu v0,a3,%lo(D_8007AFF0)
```

There are two differences:

- the target loads `0x28` into `$a3` in the entry block (the first branch's
  delay slot), while the candidate loads it into `$v0` in the case-test
  block;
- the target holds `%hi(D_8007AFF0)` in `$a0` across the switch with no copy.
  The candidate holds it in `$a1` and copies it to `$a3`, which is the extra
  instruction.

## 2. Reading the registers

A constant used in one block is a block-local pseudo. Local-alloc gives it the
first free register in allocation order. In the case-test block that is `$v0`,
because only the mode and the held `%hi` are live there, and both are global
pseudos that local-alloc does not see. `$a3` is the fifth choice. A value
allocated there conflicts with `$v0`–`$a2`, which are all busy in the entry
block. **The target's constant was born in the entry block**, so something
there already held 40. The candidate had no such register.

The prep draft said the same thing. m2c rendered the target as `mode = 0x28;`
in the entry block, and as a four-argument call
`func_80015704(sprite, header, mode_value, mode)`, because `$a2` and `$a3` are
still live at the `jal`.

- **The arguments are wrong.** The callee takes two (every other caller
  passes two), so the live registers are allocation leftovers.
- **The register fact is right.** It is the same evidence as the reading
  above.

The previous session tried `mode = 0x28` in its if-chain form (ledger entries
4–5, while the control flow was still wrong). It dropped the variable when it
moved to a `switch` and never re-tested it.

## 3. Mechanism: CSE reuses a register that already holds the case value

- **Expansion puts the constant in the case-test block.** Switch expansion
  (`emit_case_nodes`, `stmt.c:5998`) branches the `> 6` range test to a test
  label and emits the `== 0x28` test under it. The MIPS branch expander does
  not compare against a nonzero constant. It forces the constant into a fresh
  register at the test (`gen_conditional_branch`,
  `config/mips/mips.c:2856`). So at expand time the `li 40` sits in the
  case-test block in every spelling.
- **CSE follows the branch into that block.** `-fcse-follow-jumps` is on at
  -O2 (`toplev.c:4859`). The test label has a single use and follows a
  barrier, so CSE extends the entry block's path into the case-test block
  (`cse.c:8576`).
- **The variable index leaves a register holding 40.**
  `offset = D_80124FCC[index]` with `index = 10` expands to `index << 2`. CSE
  knows `index` is 10. It folds the shift to `(set r92 (const_int 40))` and
  folds the load address to `(plus ptr 40)`. The address no longer reads
  `r92`, but `r92` remains in the table as a register holding 40.
- **The case test reuses it.** The case test's `(set r104 (const_int 40))`
  joins `r92`'s equivalence class. `canon_reg` (`cse.c:2758`) rewrites the
  compare operand to the class's first register, `r92`. The set of `r104` is
  then dead and is deleted. The `.cse` dump shows the case jump comparing the
  mode against `(reg:SI 92)`.
- **The register lands in `$a3`.** `r92` is now live from the entry block to
  the case test. Global-alloc places it in `$a3`, and reorg moves it into the
  first branch's delay slot.

Controls, with each file otherwise identical (staged residual):

| How 40 enters the entry block | Residual |
|---|---|
| `offset = D_80124FCC[10];` | identical to the previous best. The front end folds a literal index into the offset, so no register ever holds 40 |
| unused `k = 0x28;` | identical to the previous best. The dead set is deleted before CSE can use it |
| `k = 0x28;` used as a byte offset, `*(s32 *)((char *)D_80124FCC[0] + k)` | `[0, 0, 1, 4]`. Same mechanism, but 40 is born at the top of the stream, ahead of the table load |
| `index = 10; offset = D_80124FCC[index];` | **EXACT** |

The index spelling is the code base's own idiom. `ovl_11_func_800E0E38` and
`ovl_11_func_800DF228` index the same table with a variable sprite index
(`sll idx,2; addu; lw`) and add `&D_8008F7F8`, exactly as this function does.
Here the index happens to be constant.

## 4. The `%hi` copy: GCSE inserts it, the allocator removes it only in `$a0`

- **GCSE inserts the copy.** GCSE PRE finds the `(high D_8007AFF0)` after the
  join redundant. It copies the entry block's `%hi` into a new reaching
  register at the end of the entry block (`pre_insert_copies`,
  `gcse.c:4361`). That copy is the candidate's extra `move`.
- **The copy disappears only if both ends share a register.** Local-alloc
  gives the entry block's `%hi` a register. Global-alloc's copy preference
  (`set_preference`, `global.c:1513`) then pulls the reaching register to the
  same one, provided it is free from the end of the entry block to the join.
  In the target that register is `$a0`.
- **`$a0` is free only if the argument copy is scheduled first.** `move s1,a0`
  must come before the `%hi` is born. The scheduler's parameter-copy pinning
  is compiled out (`#if 0`, `sched.c:2648`), so the order comes from sched1
  ties among insns boosted by `adjust_priority` (`sched.c:1958`).
  `birthing_insn_p` boosts only a destination that is set once in the whole
  function (`sched.c:1922`, `:1941`).

So the second mode read needs its own base variable (`far_base2`). Reusing
`far_base` makes it a two-set variable, and its `lo_sum` loses the boost.
Sched1 then puts the `%hi`/`%lo` pair above the argument copy while `$a0` is
still live, and the copy survives. The allocation sheet already has this rule
("A newly-ready insn is boosted only when its destination is assigned exactly
once"). Here it decides a count delta, not just a rotation.

Measured alternatives for the second read:

- reusing `far_base` gives `[0, 1, 0, 7]`;
- an inline `*(s16 *)((char *)&D_8007AFF0 + 0x25476)` gives `[0, 6, 0, 4]`,
  because it changes the population of the call block.

## 5. Statement order

Table read first, then `far_base`, is EXACT. Starting with `far_base`, or with
`index = 10; far_base = ...; offset = ...`, each leaves `[0, 0, 1, 0]`. The
index shift births 40 inside the table-load chain, and that is the position
the target's sched1 ties need.

## 6. Measured path

| Step | Residual `[cfg, pop, sched, alloc]` | Words |
|---|---|---|
| previous best (80 attempts) | `[0, 6, 1, 5]` | 58/70 |
| 40 held in a register from the entry block | `[0, 2, 3, 8]` | 58/71 |
| plus the second read through its own base pointer | `[0, 0, 1, 4]` | 62/71 |
| plus a variable index, table read first | `[0, 0, 0, 0]` | 72/72 |

## 7. What the previous attempts varied

The 80 ledger entries came from 80 distinct sources, which compiled to only 38
distinct outputs.

- After first reaching `[0, 6, 1, 5]` at 21:41, the session made 44 more
  attempts over 17 minutes. None improved the residual, and 18 different
  sources compiled to byte-identical output at that key.
- Every attempt reshaped expressions already in the program: if-chain against
  `switch`, gotos, base-pointer variables, statement order.
- No attempt added a value.

When a residual holds across a spelling family whose outputs keep colliding,
the program is missing something. Spelling cannot fix that.

## 8. Transferable rules

1. **Read a constant's register as its birth site.** Take a constant used in
   one block but allocated to a register other than the first one free there.
   It was born in an earlier block and held across the boundary. Find what in
   the dominating block computes that value.
2. **A constant born early is CSE reuse.** With jump following, CSE reuses any
   register on the path that already holds the value, such as a scaled
   variable index or a variable offset. Two spellings leave no register: a
   literal index or offset folds before RTL, and a variable that is assigned
   but never used is deleted first. When the code base indexes the same table
   through a variable elsewhere, test a variable index.
3. **Live argument registers at a call that the callee does not read are
   allocation evidence.** m2c renders them as extra arguments. Reject the
   arguments, but keep the register fact.
4. **A count delta of one `move` after a join is often a GCSE copy that failed
   to coalesce.** Find the register the original kept, then ask what made it
   free there. Here it was the argument copy's schedule, decided by the
   single-set boost.

Scratch artifacts are in `build/d0ec_claude/`: `h1.c`, the `v/*.c` variants,
`clean*.c`, and the `ctrl.c` control.
