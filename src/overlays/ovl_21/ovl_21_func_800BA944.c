#include "common.h"

INCLUDE_ASM("build/ovl_21/asm/nonmatchings/ovl_21_func_800BA944", ovl_21_func_800BA944);


/* PARKED by /auto_decompilation_loop on 2026-10-05T15:51:07.759Z.
 * Reason: escalation-exhausted.
 * Escalation reached: deepseek-v4-1-flash.
 * The best non-matching attempt is preserved verbatim below, disabled.
 * Findings and the decision needed: notes/human-needed-approvals/ovl_21_func_800BA944.md
 */

#if 0
/* Best non-matching attempt, preserved for the next session. */
#include "common.h"
#include "game_types.h"

s32 func_80012A34(s32 arg0);

s16 ovl_21_func_800BA944(s16 arg0) {
    s16 buf[4];
    s16 *bp;
    s32 sel;
    s32 tmp;
    s32 i;
    s32 pos;
    s32 step;
    UnkStruct800C0448 *base;
    s32 *p;

    sel = 0;
    i = arg0 * 3;
    if (i < arg0 * 3 + 3) {
        base = (UnkStruct800C0448 *)D_800C0448;
        p = (s32 *)((u8 *)base + ((((i << 5) + i) << 3) + 0x14));
        pos = 0x10000;
        bp = buf;
        step = 0x10000;
        for (; i < arg0 * 3 + 3; i++) {
            *bp = 0;
            if (*p == 0) {
                *bp = i;
                tmp = pos;
                pos += step;
                bp++;
                sel = tmp >> 16;
            }
            p = (s32 *)((u8 *)p + 0x108);
        }
    }
    if (sel == 0) {
        return -1;
    }
    return buf[func_80012A34(sel & 0xFFFF)];
}
#endif
