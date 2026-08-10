#include "common.h"
#include "psyq/stddef.h"
#include "psyq/libgte.h"

/*
 * MATCHES, WITH AN EXPLICIT POLICY EXCEPTION (embedded assembly).
 * Granted by the user on 2026-08-09 after the clean-C space was exhausted.
 * Full write-up: notes/retros/2026-08-09-func_800142D8-retro.md
 *
 * WHY THE ASM IS HERE. Clean C reaches 41/45 words. The whole residual is one
 * delay-slot thread choice inside cc1's `dbr` on the second guard branch:
 *   target     beq $v0,$0,$L3 / slt   $v0,$a2,92    (fall-through insn MOVED)
 *   clean C    beq $v0,$0,$L9 / addiu $v0,$v1,-128  (target insn COPIED and the
 *                                                    branch redirected -> +1)
 * Registers, schedule, webs and value provenance are otherwise byte-exact.
 * All 1,057,675 legal variable assignments over this statement skeleton were
 * enumerated (build/bruteForce/func_800142D8/): ZERO reproduce the target.
 * 13,368 reproduce the guard but then lose the calculation block's allocation.
 * The two requirements are mutually exclusive under any renaming, and the
 * skeleton is pinned from both ends (see the load-bearing facts below), so
 * there is no clean-C statement order left to try. C has no way to name a
 * delay slot, so the branch itself has to be written out.
 *
 * WHAT THE ASM DOES. It is guard branch 2 and nothing else: three instructions
 * of 44. The `slt` in the delay slot is the fall-through instruction the target
 * moves there; writing the branch by hand is the only way to place it.
 * Register allocation is still the compiler's — the operands are plain "r"
 * constraints, no hard-register pinning — and cc1 picks $v0/$a2 on its own.
 *
 * `$L3` is cc1's own label for the join point after this `if`, i.e. the entry
 * to the calculation block. It is stable for this source and this compiler.
 * If it ever moves, `as` fails loudly with an undefined symbol.
 *
 * THE TABS IN THE `.set` LINES ARE LOAD-BEARING. maspsx recognises `.set`
 * state by exact spelling (`.set\tnoreorder`) and consumes those lines itself.
 * Written with spaces they reach `gas` instead, `gas` re-enables reordering for
 * the rest of the function, and every later delay slot silently refills — 50
 * instructions, 36/50 words, no error anywhere. Do not reformat this string.
 *
 * DO NOT REDO — premises eliminated with evidence:
 * - signature: arity 2/3/4 (unused extras) give byte-identical output.
 * - flags: flagProbe finds no target fingerprint; the only 44-instruction
 *   column, -fno-rerun-cse-after-loop, scores 34/44 (it kills `move $a2,$a1`).
 * - assembler: real ASPSX 2.86 (psyq_sdk, under wine) emits `nop` for an
 *   unfilled branch — identical to maspsx — and reproduces cc1's output
 *   byte-for-byte. The delay-slot fill is cc1's, not the assembler's.
 * - tail spelling: 576 variants; rounding form, mask split, both clamp
 *   spellings, return form and declaration order are all inert.
 * - scheduler: analyzeTargetSchedule/searchSchedulerState replay .sched and
 *   .sched2 EXACTLY in all 12 blocks. Not a scheduler problem.
 *
 * Two source facts that are load-bearing; changing them regresses the file:
 * - `x` must be assigned exactly once (sched.c adjust_priority only boosts a
 *   destination with REG_N_SETS == 1); that is why `r` exists.
 * - `t = y` must not directly follow `y = arg1 & 0xFF` (cse.c rewrites and
 *   deletes a copy whose source is defined by the preceding insn).
 */
s32 func_800142D8(s32 arg0, s32 arg1) {
    s32 x;
    s32 y;
    s32 t;
    s32 xsq;
    s32 value;
    s32 original;
    s32 r;
    s32 cond;

    y = arg1 & 0xFF;
    x = arg0 & 0xFF;
    t = y;

    if ((u32)(x - 0x5C) < 0x49) {
        /* if (t >= 0xA5) goto calc; cond = (t < 0x5C); */
        __asm__ __volatile__(".set\tnoreorder\n"
                             ".set\tnomacro\n"
                             "\tslt\t%0,%1,165\n"
                             "\tbeq\t%0,$0,$L3\n"
                             "\tslt\t%0,%1,92\n"
                             ".set\tmacro\n"
                             ".set\treorder"
                             : "=&r"(cond)
                             : "r"(t));
        if (cond == 0) {
            return 0;
        }
    }

    value = x - 0x80;
    xsq = value * value;
    t = y - 0x80;
    t = t * t + xsq;
    value = csqrt(t << 12);

    original = value;
    value >>= 12;
    if (original < 0) {
        value = (original + 0xFFF) >> 12;
    }

    r = value & 0xFF;
    r -= 0x25;
    if (r < 0) {
        r = 0;
    }
    if (r >= 0x5B) {
        r = 0x5A;
    }

    return r & 0xFF;
}
