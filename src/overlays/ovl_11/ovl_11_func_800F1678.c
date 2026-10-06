#include "common.h"

INCLUDE_ASM("build/ovl_11/asm/nonmatchings/ovl_11_func_800F1678", ovl_11_func_800F1678);


/* PARKED by /auto_decompilation_loop on 2026-10-06T09:12:21.599Z.
 * Reason: escalation-exhausted.
 * Escalation reached: deepseek-v4-1-flash.
 * The best non-matching attempt is preserved verbatim below, disabled.
 * Findings and the decision needed: notes/human-needed-approvals/ovl_11_func_800F1678.md
 */

#if 0
/* Best non-matching attempt, preserved for the next session. */
#include "common.h"

s32 ovl_11_func_800F1EE4(s32 arg0);

typedef struct {
    char pad_00[0x5492];
    s16 field_5492;
} D8006C838View1678;

s32 ovl_11_func_800F1678(u8 arg0) {
    s32 temp_a0;
    s32 temp_s0;
    s32 var_v0_2;
    s16 idx;
    char *p;

    temp_s0 = arg0 & 0xFF;
    var_v0_2 = temp_s0 & 0x80;
    if (((D8006C838View1678 *)&D_8006C838)->field_5492 == -1) {
        var_v0_2 = temp_s0 & 0x40;
    }
    temp_a0 = temp_s0 & 7;
    if (var_v0_2 != 0) {
        if (temp_a0 == 7) {
            return 1;
        }
        idx = ovl_11_func_800F1EE4(temp_a0);
        p = (char *)&D_8006C838 + idx * 0x1D4;
        if (*(u16 *)(p + 0x8000 + 0x1A06) & 8) {
            if (temp_s0 & 0x20) {
                return 1;
            }
        } else if (temp_s0 & 0x10) {
            return 1;
        }
    }
    return 0;
}
#endif
