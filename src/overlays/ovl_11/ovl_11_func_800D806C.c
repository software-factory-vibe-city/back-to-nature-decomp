#include "common.h"

INCLUDE_ASM("build/ovl_11/asm/nonmatchings/ovl_11_func_800D806C", ovl_11_func_800D806C);


/* PARKED by /auto_decompilation_loop on 2026-09-16T05:25:59.853Z.
 * Reason: escalation-exhausted.
 * Escalation reached: glm-5-3-flash.
 * The best non-matching attempt is preserved verbatim below, disabled.
 * Findings and the decision needed: notes/human-needed-approvals/ovl_11_func_800D806C.md
 */

#if 0
/* Best non-matching attempt, preserved for the next session. */
#include "common.h"

s32 ovl_11_func_800D806C(s16 arg0, s16 arg1, s16 arg2, s16 arg3) {
    struct_80123E04 *temp_a3;
    char *far_base;
    s32 *temp_a1;
    s32 var_v0;

    temp_a3 = &D_80123E04 + arg3;
    if ((arg0 < 0) || (arg0 >= temp_a3->unk0)) {
        return 1;
    }
    if ((arg1 < 0) || (arg1 >= temp_a3->unk2)) {
        return 1;
    }
    far_base = (char *) &D_8007AFF0;
    temp_a1 = *(s32 **) (far_base + 0x23608 + ((arg1 * 45) + arg0) * 4);
    if ((arg2 == 0) || (var_v0 = 1, ((*temp_a1 & 8) != 0))) {
        var_v0 = 0;
    }
    return var_v0;
}
#endif
