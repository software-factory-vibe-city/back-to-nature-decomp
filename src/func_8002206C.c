#include "common.h"
#include "include_asm.h"

INCLUDE_ASM("build/asm/nonmatchings/func_8002206C", func_8002206C);


/* PARKED by /auto_decompilation_loop on 2026-08-22T07:34:12.228Z.
 * Reason: escalation-exhausted.
 * Escalation reached: deepseek-v4-flash.
 * The best non-matching attempt is preserved verbatim below, disabled.
 * Findings and the decision needed: notes/human-needed-approvals/func_8002206C.md
 */

#if 0
/* Best non-matching attempt, preserved for the next session. */
#include "common.h"

u32 Rand(s32 arg0);
s32 func_80022014(s32 arg0, s16 arg1);

void func_8002206C(void) {
    s16 *walk;
    s16 *pVal;
    s16 *pPos1;
    s16 *pPos2;
    s16 *pColor1;
    s16 *pColor2;
    s16 *pW;
    u16 *src;
    u16 *sbase;
    u32 rows;
    u32 rowByte;
    u32 n;
    s16 v;
    s32 saved;
    s32 max;

    saved = D_8007AD4C;
    memset((void *)&D_8007AD4C, 0, 0x108);

    /* Mark every slot empty. */
    for (rows = 0; rows < 3U; rows++) {
        for (n = 0; n < 6U; n++) {
            *(s16 *)((char *)&D_8007AD4E + rows * 0x54 + n * 14) = -1;
        }
    }

    /* Deal cards: unique value, colors, and position range. */
    rows = 0;
    n = 0;
    do {
        u32 rb = rows * 0x54;
        sbase = D_80055944;
        src = sbase + 2;
        pPos2 = (s16 *)((char *)&D_8007AD52 + rb);
        pPos1 = (s16 *)((char *)&D_8007AD50 + rb);
        pColor2 = (s16 *)((char *)&D_8007AD56 + rb);
        pColor1 = (s16 *)((char *)&D_8007AD54 + rb);
        pVal = (s16 *)((char *)&D_8007AD4E + rb);
    loop_card:
        v = (s16)Rand(0x28);
        if (func_80022014((s32)&D_8007AD4C, v) != 0) {
            goto loop_card;
        }
        *pVal = v;
        pVal += 7;
        n++;
        *pColor1 = *(u16 *)((char *)&D_800558A4 + (v * 4));
        *pColor2 = *(u16 *)((char *)&D_800558A4 + ((v * 4) | 2));
        pColor2 += 7;
        pColor1 += 7;
        *pPos1 = (s16)(src[-2] + Rand((u16)(src[-1] - src[-2])));
        *pPos2 = (s16)(src[0] + Rand((u16)(src[1] - src[0])));
        src += 4;
        pPos1 += 7;
        pPos2 += 7;
        if (n < 6U) {
            goto loop_card;
        }
        n = 0;
        rows++;
    } while (rows < 3U);

    /* Set a specific card for the special game mode. */
    if (saved == 3) {
        char *p = (char *)&D_8007AD4C;
        char *q = (char *)&D_8006C838;
        u16 r0 = *(u16 *)(q + 0x9348);
        u16 r1 = *(u16 *)(q + 0x92B2);
        *(s16 *)(p + 0xC6) = -1;
        *(s16 *)(p + 0xCC) = 0;
        *(s16 *)(p + 0xCE) = 0;
        *(s16 *)(p + 0xC8) = (s16)r0;
        *(s16 *)(p + 0xCA) = (s16)r1;
    }

    /* Per-row weights from the row's largest pos1. */
    rows = 0;
    max = 0;
    do {
        n = 0;
        walk = (s16 *)((char *)&D_8007AD50 + rows * 0x54);
        do {
            if ((u32)max < (u32)*walk) {
                max = *walk;
            }
            n++;
            walk += 7;
        } while (n < 6U);
        n = 0;
        pW = (s16 *)((char *)&D_8007AD58 + rows * 0x54);
        pPos1 = (s16 *)((char *)&D_8007AD50 + rows * 0x54);
        do {
            s32 dd = max - *pPos1;
            u32 sq = (u32)(dd * dd);
            *pW = (s16)(Rand(4) + sq / 1000 + 1);
            pPos1 += 7;
            n++;
            pW += 7;
        } while (n < 6U);
        rows++;
        max = 0;
    } while (rows < 3U);
}
#endif
