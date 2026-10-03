#include "common.h"

INCLUDE_ASM("build/ovl_21/asm/nonmatchings/ovl_21_func_800B98CC", ovl_21_func_800B98CC);


/* PARKED by /auto_decompilation_loop on 2026-10-03T20:59:10.060Z.
 * Reason: asm-needs-human-approval.
 * Escalation reached: deepseek-v4-1-flash.
 * The best non-matching attempt is preserved verbatim below, disabled.
 * Findings and the decision needed: notes/human-needed-approvals/ovl_21_func_800B98CC.md
 */

#if 0
/* Best non-matching attempt, preserved for the next session. */
#include "common.h"

typedef struct {
    char pad_0[0x2];
    s16 unk2;
    char pad_4[0x14];
    s32 unk18;
    u16 unk1C;
} Ovl21Unk800B98CC;

s32 ovl_21_func_800B98CC(Ovl21Unk800B98CC *arg0) {
    s32 result;
    if (arg0->unk2 >= 3) {
        result = ((u32)arg0->unk1C) < (u32)3;
        arg0->unk18 = result;
        return result;
    } else {
        result = ((u32)(arg0->unk1C + -3)) < (u32)3;
        arg0->unk18 = result;
        return result;
    }
}
#endif
