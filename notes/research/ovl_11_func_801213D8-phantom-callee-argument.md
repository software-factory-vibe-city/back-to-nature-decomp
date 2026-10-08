# ovl_11_func_801213D8 — a phantom callee argument and an assembler patch

**Date:** 2026-10-08
**Outcome:** `ovl_11_func_801213D8` is EXACT, 72/72 words, residual
`[0, 0, 0, 0]`. `make check-all` passes on upstream maspsx. The previous
session's 23 ledger attempts had stopped at `[cfg 0, pop 0, sched 5,
alloc 1]`.

The residual had two independent causes, and neither was a spelling:

1. **A toolchain defect.** A local maspsx patch filled the first call's
   delay slot, so no C source could match. The patch is now removed.
2. **A phantom argument.** A third argument to `ovl_11_func_800F5888` that
   the callee never reads reordered the argument setup of the second call.

---

## 1. Block 1: the delay slot no source could reach

```asm
/* target */                         /* any source, patched maspsx */
lh    a1,0(s0)                       lh    a1,0(s0)
jal   func_80015A18                  jal   func_80015A18
nop                                  lui   a1,0x5555    # clobbers arg 2
lui   a1,0x5555                      lhu   a2,2(s0)
```

cc1 leaves this `jal`'s slot empty: the branch is not inside a
`.set noreorder` block. The next instruction is `li $5,0x55550000`, the start
of the `/ 3` reciprocal. The local maspsx patch (`adffb69`) let any
`lui`-only `li` fall into a branch or jump slot. That shortened the function
by one word and clobbered the callee's second argument.

The residual tool reported the difference as one word of **schedule**. The
cause was the assembler, and the result is resolved in `notes/maspsx-issue3.md`:

- a census of all 2,681 cc1 outputs found only this site and `func_80021820`;
- a clean `func_80021820` gets its fill from cc1's own delay-slot pass;
- the patch is removed.

## 2. Block 5: the argument setup for `func_80015EE8`

```asm
/* target */                         /* previous best */
lh    a2,0x20(sp)    # arg 5 -> a2   lw    a0,0x28(sp)
lw    a0,0x28(sp)                    lbu   a2,0(s0)     # arg 3 early
lh    v0,0x24(sp)                    lh    v0,0x20(sp)
...                                  ...
sw    a2,0x10(sp)                    sw    v0,0x10(sp)
sw    v0,0x14(sp)                    addu  a0,a3,a0
lbu   a2,0(s0)       # arg 3 late    andi  a3,s1,0xff
addu  a0,a3,a0                       jal   func_80015EE8
jal   func_80015EE8                   sw   v1,0x14(sp)
 andi a3,s1,0xff
```

In the target, stack argument 5 lives in `$a2` and is stored before the
`lbu` of argument 3 into `$a2`. That allocation is possible only if
argument 3's load is not live early.

- **Expansion is fixed.** With `PROMOTE_FUNCTION_ARGS` and
  `PROMOTE_PROTOTYPES`, argument 3's zero-extend is computed in
  `precompute_register_parameters`, before the stack stores (`calls.c:614`,
  `:2203`).
- **Combine cannot fold it later.** It cannot merge that load into the late
  `$a2` copy: `use_crosses_set_p` refuses to move a memory read past the
  stack stores (`combine.c:10888`).
- **Sched1 decides.** The `lbu` lands wherever its consumer, the `$a2` copy,
  is scheduled.
- **The copy's priority depends on `$a2` being set once.** `birthing_insn_p`
  boosts a newly ready insn only if its destination is set exactly once in
  the whole function (`sched.c:1941`).
  - With a three-argument `ovl_11_func_800F5888(pos, out, tick)`, `$a2` is
    set twice. The copy keeps priority 2, and the function-unit hazard
    tie-break pulls both stack stores after it.
  - With two arguments, the copy is boosted alongside the `$a3` copy. It is
    scheduled right before the call, after the stores, and the allocation
    follows.

**Control:** the final source with the three-argument call is 63/72; with
two it is 72/72.

The callee's third parameter has no witness:

- `ovl_11_func_800F5888` loads `$a2` (`lhu $a2,2($a3)`) before ever reading
  it;
- none of its twelve target call sites writes `$a2` before the call.

`ovl_11_func_800E48CC` hit the same phantom argument two days earlier
(`notes/research/ovl_11_func_800E48CC-unused-callee-arg-coalescing.md`). That
time it caused a surviving copy rather than a schedule. The definition was not
corrected then, and callee truth still reported the three-argument call as
"corroborated". The definition now declares two parameters. The tool gaps
that let it recur are in `notes/research/tooling-false-verdicts.md` §5–§6.

## 3. Things that did not matter

Struct typing of the record (`Struct_801213D8`), a `u8` prototype for
`func_80015EE8`'s byte parameters, and ordering-table pointer arithmetic all
compiled to the same block 5. The previous session's variants all kept the
three-argument call, so every one of them measured a different program from
the original.

## 4. Transferable rules

1. **A residual in a call's argument setup is a signature question first.**
   Check that every argument the caller passes is read by the callee's target
   code. An unread argument changes the caller even when it emits no new
   instruction: it is one more set of a hard register, which removes the
   sched1 boost on that register's other sets.
2. **A delay slot cc1 left empty is the assembler's decision.** If cc1's
   `.s` has the branch outside `.set noreorder`, assemble the same file
   through upstream maspsx before writing source variants.
3. **When two sessions trip on the same callee, fix the callee.** A
   per-caller workaround in a research note does not reach the next m2c
   draft. The definition, and the m2c context generated from it, does.

Scratch artifacts are in `build/213d8_claude/` and `build/21820_claude/`:
the harnesses `asm.sh`, `exe.sh` and `cmp.ts`, the variants, and the
narrowed and upstream maspsx copies.
