#include "common.h"
#include "include_asm.h"

INCLUDE_ASM("build/asm/nonmatchings/func_80018B98", func_80018B98);


/* PARKED by /auto_decompilation_loop on 2026-08-18T00:31:21.833Z.
 * Reason: escalation-exhausted.
 * Escalation reached: deepseek-v4-flash.
 * The best non-matching attempt is preserved verbatim below, disabled.
 * Findings and the decision needed: notes/human-needed-approvals/func_80018B98.md
 */

#if 0
/* Best non-matching attempt, preserved for the next session. */
#include "common.h"

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
void func_8001FABC(s32 arg0);
s16 GetPairedTpage(s32 tpage);
void func_80019FC4(s16 arg0);
void *func_80019070(s32 *ordering_table, u8 *packet, u32 glyph, s32 x,
                    s16 y, u8 red, u8 green, u8 blue, u32 palette,
                    s32 semitransparent);
s32 func_8001A284(s32 arg0);

u8 *func_80018B98(s32 *arg0, u8 *arg1, volatile u16 *arg2, s16 arg3, s16 arg4,
                  s32 arg5, s32 arg6, s32 arg7, s32 arg8, s32 arg9) {
    u16 tok;
    s32 masked;
    u32 flag;
    s32 glyphp;
    s32 xdelta;
    s32 ydelta;

    if (arg8 == 0) {
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
                } else if (arg2[D_8005E444] < 0xE01U &&
                           (arg2[0] & 0x4000) != 0) {
                    D_8005E444 = (u16)(D_8005E444 + 1);
                }
            }
        }
    }

    D_8005E478 = arg3;
    D_8005E47A = (u16)arg4;

    flag = (u32)(D_8005E446 - 7) < 3U;

    while (1) {
        if (arg6 == 1) {
            if (!((s16)D_8005E47E < (u16)D_8005E444)) {
                break;
            }
            D_8005E47E = (u16)((u16)D_8005E47E + 1);
            if (D_8005E446 == 1) {
                /* advance */
            } else if ((s16)D_8005E480 == (s16)D_8005E47E) {
                /* advance */
            } else if (flag != 0) {
                /* advance */
            } else {
                D_8005E446 = 0;
            }
        }

        tok = *arg2;
        masked = tok & 0xFFFF;

        if (masked == 0xFFFF) {
            if (arg6 != 0 && arg8 == 0 && flag == 0) {
                D_8005E446 = 2;
            }
            break;
        }

        if (masked == 0xFFFE) {
            D_8005E47A = D_8005E2BA + ((u16)D_8005E47A + 0xC);
            D_8005E478 = (u16)D_8005E47C;
            if (arg9 != 0) {
                D_8005E478 = D_8005E498;
            }
            arg2++;
            continue;
        }

        if (masked == 0xFFC) {
            if (D_8005E446 == 1) {
                arg2++;
                continue;
            }
            D_8005E446 = 3;
            D_8005E480 = (u16)D_8005E47E;
            arg2++;
            continue;
        }

        if (masked == 0xFFB) {
            arg2++;
            continue;
        }

        if ((u32)(u16)(tok - 0xFF8) < 3U) {
            arg2++;
            continue;
        }

        if ((u32)(u16)(tok - 0xE38) < 0x1B8U) {
            D_8005E454 = GetPairedTpage(*arg2);
            arg2++;
            continue;
        }

        if (masked == 0xFF7) {
            func_80019FC4(D_8005E454);
            arg2++;
            continue;
        }

        if (masked == 0xFF6) {
            D_8005E464 = 0;
            arg2++;
            continue;
        }

        if (masked == 0xFF5) {
            D_8005E458 = 1;
            arg2++;
            continue;
        }

        if (masked == 0xFF4) {
            D_8005E464 = 1;
            arg2++;
            continue;
        }

        if ((u32)(u16)(tok - 0xE25) < 0xBU) {
            D_8005E470 = (s16)(0xE2F - tok);
            arg2++;
            continue;
        }

        if (masked == 0xFF3) {
            D_8005E474 = 1;
            arg2++;
            continue;
        }

        if (masked == 0xFF2) {
            arg2++;
            continue;
        }

        if (masked == 0xFF1) {
            D_8005E488 = 1;
            arg2++;
            continue;
        }

        if (tok & 0x4000) {
            glyphp = func_8001A284(*arg2);
            if (glyphp == 0) {
                glyphp = D_8005F0C8[*arg2 & 0xFFF];
                if (glyphp == 0) {
                    arg2++;
                    continue;
                }
            }
            arg1 = (u8 *)func_80018B98(arg0, arg1, (u16 *)glyphp,
                                         D_8005E478, (s16)D_8005E47A, arg5,
                                         arg6, arg7, 1, 0);
            arg2++;
            continue;
        }

        if ((tok & 0xFFF) != 0xFFD) {
            xdelta = (D_8005E478 - arg3) * arg5;
            if (xdelta < 0) {
                xdelta += 0xFFF;
            }
            ydelta = (D_8005E47A - arg4) * arg5;
            if (ydelta < 0) {
                ydelta += 0xFFF;
            }
            arg1 = (u8 *)func_80019070(arg0, arg1, *arg2,
                                         (s32)(s16)(arg3 + (xdelta >> 12)),
                                         (s16)(s32)(s16)(arg4 + (ydelta >> 12)),
                                         0x80, 0x80, 0x80, D_8005E450, arg7);
        }
        D_8005E478 = D_8005E2B8 + ((u16)D_8005E478 + 8);

        arg2++;
    }

    D_8005E482 = arg2[-1];
    return arg1;
}
#endif
