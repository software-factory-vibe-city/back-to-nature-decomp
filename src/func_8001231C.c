#include "common.h"
#include "include_asm.h"

INCLUDE_ASM("build/asm/nonmatchings/func_8001231C", func_8001231C);

/*
 * func_8001231C — PARKED 2026-08-11 with a ready playbook. Not yet attempted.
 *
 * Do NOT start from psx_m2c or from a fresh reading of the disassembly.
 * This function is a near-verbatim clone of func_80012598 (matched 2026-08-11):
 * same 0x40 frame, same graphics-heap carve, and a first loop whose 21 register
 * webs and store partition are identical. Copy src/func_80012598.c and apply
 * six deltas.
 *
 * Full recipe, with the register-rotation table, the verification commands, the
 * trap list and the stop rule: notes/research/func_8001231C.md
 * Underlying mechanism and measurements: notes/research/func_80012598.md
 *
 * The six deltas, in brief:
 *   1. D_8005E3BC / D_8005E3B8 take 0x801F7000, not 0x801FCFF8.
 *   2. The work-area stride is 0x2EE0, not 0x5EDC (both the spilled accumulator
 *      increment and the length stored to 0x128). 0x33090 is unchanged.
 *   3. The second phase is a call, not an inlined loop: `func_8001E160();`
 *      — declare it `void func_8001E160(void)`; it is already matched.
 *   4. Rotate the register pins: &D_8005E5E8 is $t8 (not $s0), the byte pointer
 *      is $t9 (not $s1), and the p0/p1/p2 pool cursors are $s0/$s1/$s2 (not
 *      $s2/$t8/$t9). Everything else keeps its register.
 *   5. The base is `addu $a0, $t8, $t7` — base register first, as in the parent.
 *   6. The symbol load is the same split `lui %hi` / `addiu %lo` pair the parent
 *      needs hand-written; change only the output register.
 *
 * Two things that will waste a session if ignored:
 *   - `diffFunc --src` is not the verdict here. It reported
 *     "MISMATCH — 0 word(s) differ" on func_80012598 while the linked binary
 *     differed in 25 words; `0 differing` with `same < total` means displacement.
 *     Use `--bytes` or `make check`.
 *   - The target's base-address copies are reload rematerialisations, not CSE
 *     artifacts (lreg 4 reg-to-reg sets -> greg 18). Do not try to create them
 *     from source pointer variables; that consumed two sessions on the parent.
 */
