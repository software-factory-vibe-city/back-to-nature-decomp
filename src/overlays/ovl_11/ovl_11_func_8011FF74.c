#include "common.h"

INCLUDE_ASM("build/ovl_11/asm/nonmatchings/ovl_11_func_8011FF74", ovl_11_func_8011FF74);


/* PARKED by /auto_decompilation_loop on 2026-08-24T06:51:14.310Z.
 * Reason: asm-needs-human-approval.
 * Escalation reached: deepseek-v4-flash.
 * The best non-matching attempt is preserved verbatim below, disabled.
 * Findings and the decision needed: notes/human-needed-approvals/ovl_11_func_8011FF74.md
 */

#if 0
/* Best non-matching attempt, preserved for the next session. */
#include "common.h"

typedef struct {
    /* 0x00 */ char pad00[0x16];
    /* 0x16 */ s16 unk16;
} UnkStruct8011FF74;

void ovl_11_func_8011FF74(UnkStruct8011FF74 *arg0, s16 arg1) {
    s32 limit = 0xFF - arg1;
    if (arg0->unk16 < limit) {
        arg0->unk16 = (s16)(arg1 + (u16)arg0->unk16);
        return;
    }
    arg0->unk16 = 0xFF;
}
#endif
