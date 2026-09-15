#include "common.h"

INCLUDE_ASM("build/ovl_11/asm/nonmatchings/ovl_11_func_800D812C", ovl_11_func_800D812C);


/* PARKED by /auto_decompilation_loop on 2026-09-15T08:02:09.016Z.
 * Reason: escalation-exhausted.
 * Escalation reached: glm-5-3-flash.
 * The best non-matching attempt is preserved verbatim below, disabled.
 * Findings and the decision needed: notes/human-needed-approvals/ovl_11_func_800D812C.md
 */

#if 0
/* Best non-matching attempt, preserved for the next session. */
#include "common.h"

typedef struct {
    /* 0x0 */ s32 unk0;
    /* 0x4 */ char pad_4[0x4];
    /* 0x8 */ s32 unk8;
} Recon800D812CA2View;

s32 ovl_11_func_800D812C(s16 arg0, s16 arg1, Recon800D812CA2View *arg2, s16 arg3) {
    s32 ret;

    if (arg3 == 0) {
        arg2->unk0 = arg0 * 400 - 0x1068;
        ret = 0x578 - arg1 * 400;
    } else {
        arg2->unk0 = arg0 * 400 - 0x58C;
        ret = 0x3FC - arg1 * 400;
    }
    arg2->unk8 = ret;
    return ret;
}
#endif
