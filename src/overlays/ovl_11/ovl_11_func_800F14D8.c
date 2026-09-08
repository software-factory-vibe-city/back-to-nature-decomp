#include "common.h"

INCLUDE_ASM("build/ovl_11/asm/nonmatchings/ovl_11_func_800F14D8", ovl_11_func_800F14D8);


/* PARKED by /auto_decompilation_loop on 2026-09-08T20:25:35.146Z.
 * Reason: escalation-exhausted.
 * Escalation reached: deepseek-v4-flash.
 * The best non-matching attempt is preserved verbatim below, disabled.
 * Findings and the decision needed: notes/human-needed-approvals/ovl_11_func_800F14D8.md
 */

#if 0
/* Best non-matching attempt, preserved for the next session. */
#include "common.h"

s32 ovl_11_func_800F14D8(s32 arg0, s32 arg1, s32 arg2) {
    s32 i;
    s32 x;
    s32 target;
    s32 found;

    arg0 &= 0xFFFF;
    arg1 &= 0xFFFF;
    if ((arg0 == 31) || (arg1 == 31)) {
        return 1;
    }
    i = 0;
    target = *(s16 *)(arg2 + 4);
    if (arg1 >= 30) {
        arg1 = 29;
    }
    found = 0;
    arg1++;
    for (; i < arg1; i++) {
        x = arg0 + i;
        if (x >= 31) {
            x -= 29;
        }
        if (x == target) {
            found = 1;
            break;
        }
    }
    return found;
}
#endif
