#include "common.h"
#include "include_asm.h"

INCLUDE_ASM("build/asm/nonmatchings/func_80018B98", func_80018B98);


/* PARKED by manual session on 2026-08-21.
 * Re-parked after the clean-C best reached 257/292 (87.7%), key [0,2,3,9]:
 * residual pop 2 / sched 3 / alloc 9, owner greg (register allocation).
 * The func_80019070-style hybrid-window exception was granted and then
 * MEASURED NON-TRANSFERABLE (9 pin/window shapes, all worse than 257/292 —
 * see notes/research/func_80018B98-hybrid-asm-and-clean-ceiling.md and the
 * experiment ledger; do not re-attempt bare register-asm pins without new
 * evidence). Decision pending (notes/human-needed-approvals/func_80018B98.md):
 * 1) exhaustive current-source closure search (2.7M / 148 web-partition
 *    candidates, ~1.8h) still open; 2) if empty, full-asm INCLUDE_ASM body for
 *    byte-exact (assembly-stub exception); 3) otherwise hold 257/292.
 * The best non-matching attempt is preserved verbatim below, disabled.
 */

#if 0


/* ============================================================================
 * STATUS (reparked 2026-08-21): clean-C best = 257/292 words (87.7%).
 * Residual key [0,2,3,9] = pop 2, sched 3, alloc 9; owner is greg (register
 * allocation), not instruction selection or semantics.
 *
 * Classification (see notes/file-groupings.md func_80018B98 entry and
 * notes/research/func_80018B98-hybrid-asm-and-clean-ceiling.md):
 *  - inner loop register rotation: tok >$a1 (with the surviving `move a1,tok`
 *    copy), masked >$a0, remasked >$v1; candidate emits $v1/$a2/$a0.
 *  - s5/s6 swap: the `flag` web should be $s5, the arg5 scale web $s6.
 *  - blocks 20/21 population: target keeps a shared return-set block
 *    (.L80018FF4 `addu v0,s1`) that the 0xFFFF flag-branch enters and the
 *    candidate skips.
 *  - All premises audited clean: callee_truth 0 contradicted, frame map + 4-byte
 *    BLKmode TextFlag arg8 confirmed (s32 variant regresses), wrappers
 *    func_80019564/func_80017B3C corroborate; -fno-gcse dominant (flag probe).
 *
 * The func_80019070-style hybrid exception (register-asm/embedded-asm windows)
 * was GRANTED (2026-08-21) and then measured as NON-TRANSFERABLE to this
 * function: every one of 9 pin/window shapes (pins on masked/tok/flag/scale/
 * remasked, all-param homes, split y-delta) regresses the baseline. GCC 2.95
 * resolves each fixed-register constraint by global spill/shuffle, so a pin
 * fixes one node and cascades into distant blocks; the masked->y-delta reuse is
 * load-bearing (splitting it destroys the mult tail). func_80019070's hybrid
 * worked because its divergence was one isolated prologue window, not a
 * whole-function register topology in a nested loop.
 *
 * NEXT STEPS (decision pending, see
 * notes/human-needed-approvals/func_80018B98.md):
 *  1. Exhaustive current-source closure search (2,727,936 candidates, 148 web
 *     partitions, ~1.8h) — the last clean-C channel that can still find the
 *     natural allocation (richer than the exhausted ancestor seeds).
 *  2. If empty: full-asm INCLUDE_ASM body for byte-exact (needs an assembly-
 *     stub allowlist entry, a stronger category than the window hybrid).
 *  3. Otherwise hold this clean 257/292 semantic model.
 *
 * Do NOT re-attempt bare register-asm pins without new evidence — nine
 * measured counterexamples are in the experiment ledger.
 * ============================================================================ */

/* TU-owned GP globals (tentative definitions -> .comm, so cc1 emits the
 * target's %gp_rel accesses). Types match include/globals.h where present. */
u16 D_8005E2B8;
u16 D_8005E2BA;
u16 D_8005E444;
u16 D_8005E446;
s16 D_8005E44C;
s16 D_8005E478;
s16 D_8005E47A;
s16 D_8005E47E;
u16 D_8005E482;
u32 D_8005E448;
u32 D_8005E450;
s16 D_8005E454;
s32 D_8005E458;
s32 D_8005E464;
s16 D_8005E470;
s32 D_8005E474;
u16 D_8005E47C;
u16 D_8005E480;
s32 D_8005E488;
s32 D_8005E48C;
u16 D_8005E498;

/* Game callees. */
s32 func_80012CB4(s32 arg0, s32 *arg1, s32 arg2);
void func_8001FABC(s16 arg0);
s16 GetPairedTpage(s32 tpage);
void func_80019FC4(s16 arg0);
void *func_80019070(s32 *ordering_table, u8 *packet, u32 glyph, s32 x,
                    s16 y, u8 red, u8 green, u8 blue, u32 palette,
                    s32 semitransparent);
s32 func_8001A284(s32 arg0);

typedef struct {
    u8 b[4];
} TextFlag;

s32 func_80018B98(s32 *arg0, s32 arg1, u16 *arg2, s16 arg3, s16 arg4,
                  s32 arg5, s32 arg6, s32 arg7, TextFlag arg8, s32 arg9) {
    s32 tok;
    s32 masked;
    s32 x;
    u16 remasked;
    u32 flag;
    u32 flagtmp;
    s32 glyphp;
    u16 glyph;
    s32 i;

    if (*(s32 *)&arg8 == 0) {
        D_8005E47C = (u16)arg3;
        if (arg6 == 1) {
            D_8005E47E = 0;
            if (D_8005E446 == 0) {
                if (func_80012CB4(D_8005E44C, &D_8005E448, 1) == arg6) {
                    if (D_8005E48C != 0) {
                        func_8001FABC(4);
                        D_8005E48C = 0;
                    } else {
                        D_8005E48C = arg6;
                    }
                    D_8005E444 = (u16)(D_8005E444 + 1);
                } else if (arg2[D_8005E444] >= 0xE01U ||
                           (arg2[0] & 0x4000) != 0) {
                    D_8005E444 = (u16)(D_8005E444 + 1);
                }
            }
        }
    }

    flagtmp = (u32)D_8005E446 - 7;
    flag = flagtmp < 3U;

    D_8005E478 = arg3;
    D_8005E47A = (u16)arg4;

    if (arg6 != 1) {
        goto inner;
    } else {
        goto outer_test;
    }

outer_body:
    i++;
    D_8005E47E = (u16)i;
    if (D_8005E446 == 1) {
        /* advance */
    } else if ((s16)D_8005E480 == (s16)i) {
        /* advance */
    } else if (flag != 0) {
        /* advance */
    } else {
        D_8005E446 = 0;
    }

inner:
        tok = *arg2;
        masked = tok & 0xFFFF;

        if (masked == 0xFFFF) {
            if (arg6 != 0 && *(s32 *)&arg8 == 0 && flag == 0) {
                D_8005E446 = 2;
            }
            goto done;
        }

        if (masked == 0xFFFE) {
            D_8005E47A = D_8005E2BA + ((u16)D_8005E47A + 0xC);
            D_8005E478 = (u16)D_8005E47C;
            if (arg9 != 0) {
                D_8005E478 = D_8005E498;
                arg2++;
                goto loop_latch;
            }
            goto advance;
        }

        if (masked == 0xFFC) {
            if (D_8005E446 == 1) {
                goto advance;
            }
            D_8005E446 = 3;
            D_8005E480 = (u16)D_8005E47E;
            arg2++;
            goto loop_latch;
        }

        if (masked == 0xFFB) {
            goto advance;
        }

        if ((u32)((tok - 0xFF8) & 0xFFFF) < 3U) {
            goto advance;
        }

        if ((u32)((tok - 0xE38) & 0xFFFF) < 0x1B8U) {
            glyph = *(volatile u16 *)arg2;
            arg2++;
            D_8005E454 = GetPairedTpage(glyph);
            goto loop_latch;
        }

        if (masked == 0xFF7) {
            func_80019FC4(D_8005E454);
            arg2++;
            goto loop_latch;
        }

        if (masked == 0xFF6) {
            D_8005E464 = 0;
            arg2++;
            goto loop_latch;
        }

        if (masked == 0xFF5) {
            D_8005E458 = 1;
            arg2++;
            goto loop_latch;
        }

        if (masked == 0xFF4) {
            D_8005E464 = 1;
            arg2++;
            goto loop_latch;
        }

        if ((u32)((tok - 0xE25) & 0xFFFF) < 0xBU) {
            D_8005E470 = (s16)(0xE2F - tok);
            arg2++;
            goto loop_latch;
        }

        remasked = tok & 0xFFFF;
        if (masked == 0xFF3) {
            D_8005E474 = 1;
            arg2++;
            goto loop_latch;
        }

        if (remasked == 0xFF2) {
            goto advance;
        }

        if (remasked == 0xFF1) {
            D_8005E488 = 1;
            arg2++;
            goto loop_latch;
        }

        if (tok & 0x4000) {
            glyphp = func_8001A284(*arg2);
            if (glyphp == 0) {
                glyphp = D_8005F0C8[*arg2 & 0xFFF];
                if (glyphp == 0) {
                    goto advance;
                }
            }
            arg1 = ((s32 (*)(s32 *, s32, u16 *, s16, s16, s32, s32, s32,
                               s32, s32))func_80018B98)(
                arg0, arg1, (u16 *)glyphp, D_8005E478, (s16)D_8005E47A,
                arg5, arg6, arg7, 1, 0);
            goto advance;
        }

        if ((tok & 0xFFF) != 0xFFD) {
            tok = (D_8005E478 - arg3) * arg5;
            if (tok < 0) {
                tok += 0xFFF;
            }
            x = (s32)(s16)(arg3 + (tok >> 12));
            masked = (D_8005E47A - arg4) * arg5;
            if (masked < 0) {
                masked += 0xFFF;
            }
            arg1 = (u8 *)func_80019070(arg0, arg1, *arg2, x,
                                         (s16)(s32)(s16)(arg4 + (masked >> 12)),
                                         0x80, 0x80, 0x80, D_8005E450, arg7);
        }
        D_8005E478 = D_8005E2B8 + ((u16)D_8005E478 + 8);

advance:
        arg2++;
loop_latch:
    if (arg6 == 1) {
        goto outer_test;
    }
    goto inner;
outer_test:
    i = (u16)D_8005E47E;
    if ((u16)D_8005E444 > (s16)D_8005E47E) {
        goto outer_body;
    }
done:
    D_8005E482 = arg2[-1];
    return arg1;
}

#endif
