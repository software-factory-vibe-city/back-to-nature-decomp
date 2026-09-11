#include "common.h"

INCLUDE_ASM("build/ovl_11/asm/nonmatchings/ovl_11_func_800F1540", ovl_11_func_800F1540);


/* PARKED by /auto_decompilation_loop on 2026-09-11T04:15:33.436Z.
 * Reason: escalation-exhausted.
 * Escalation reached: deepseek-v4-flash.
 * The best non-matching attempt is preserved verbatim below, disabled.
 * Findings and the decision needed: notes/human-needed-approvals/ovl_11_func_800F1540.md
 */

#if 0
/* Best non-matching attempt, preserved for the next session. */
#include "common.h"

s32 ovl_11_func_800F1540(u16 arg0, s32 arg1) {
    s32 temp_a2;

    temp_a2 = arg0 >> 0xA;
    if (temp_a2 != 0x3F) {
        char *far_base;
        s32 ptr;
        s32 val;

        far_base = (char *)&D_8007AFF0;
        if (arg1 < 0) {
            ptr = *(s32 *)(far_base + 0x2538C);
            val = *(s16 *)(ptr + 2);
            return temp_a2 != val;
        }
        ptr = *(s32 *)(far_base + 0x2538C);
        val = *(s16 *)(ptr + 2);
        return temp_a2 == val;
    }
    return 1;
}
#endif
