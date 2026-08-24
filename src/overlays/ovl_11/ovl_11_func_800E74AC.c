#include "common.h"

INCLUDE_ASM("build/ovl_11/asm/nonmatchings/ovl_11_func_800E74AC", ovl_11_func_800E74AC);


/* PARKED by /auto_decompilation_loop on 2026-08-24T18:36:18.644Z.
 * Reason: escalation-exhausted.
 * Escalation reached: deepseek-v4-flash.
 * The best non-matching attempt is preserved verbatim below, disabled.
 * Findings and the decision needed: notes/human-needed-approvals/ovl_11_func_800E74AC.md
 */

#if 0
/* Best non-matching attempt, preserved for the next session. */
#include "common.h"

s32 ovl_11_func_800E74AC(s16 arg0, s16 arg1, s32 arg2, s32 arg3) {
    s16 *p = (s16 *)&D_8006C838;
    s16 x = p[0x2964];
    s16 y = p[0x2968];
    s32 dx = x - arg2;
    s32 result;

    if (dx < 0) {
        dx = -dx;
    }
    if (dx < arg0) {
        s32 dy = y - arg3;
        if (dy < 0) {
            dy = -dy;
        }
        result = dy < arg1;
    } else {
        result = 0;
    }
    return result;
}
#endif
