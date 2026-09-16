#include "common.h"

INCLUDE_ASM("build/ovl_11/asm/nonmatchings/ovl_11_func_801031E4", ovl_11_func_801031E4);


/* PARKED by /auto_decompilation_loop on 2026-09-16T13:13:12.809Z.
 * Reason: escalation-exhausted.
 * Escalation reached: glm-5-3-flash.
 * The best non-matching attempt is preserved verbatim below, disabled.
 * Findings and the decision needed: notes/human-needed-approvals/ovl_11_func_801031E4.md
 */

#if 0
/* Best non-matching attempt, preserved for the next session. */
#include "common.h"

extern u16 D_80127404[];
extern u16 D_8012CF00[8];

s32 ovl_11_func_801031E4(u16 arg0) {
    u16 *p;
    u16 *row;
    u16 val;
    s32 idx;
    s32 i;
    s32 j;

    switch (arg0) {
    case 0x181:
        idx = 0;
        break;
    case 0x182:
        idx = 1;
        break;
    case 0x183:
        idx = 2;
        break;
    case 0x184:
        idx = 3;
        break;
    default:
        return 0;
    }
    p = D_8012CF00;
    for (i = 0; i < 8; i++) {
        val = D_8012CF00[i];
        row = &D_80127404[idx * 4];
        for (j = 0; j < 4; j++) {
            if (val == *row) {
                *p = 0;
                return 1;
            }
            row++;
        }
        p++;
    }
    return 2;
}
#endif
