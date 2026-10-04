#include "common.h"

INCLUDE_ASM("build/ovl_17/asm/nonmatchings/ovl_17_func_800B9158", ovl_17_func_800B9158);


/* PARKED by /auto_decompilation_loop on 2026-10-04T08:43:48.340Z.
 * Reason: asm-needs-human-approval.
 * Escalation reached: deepseek-v4-1-flash.
 * The best non-matching attempt is preserved verbatim below, disabled.
 * Findings and the decision needed: notes/human-needed-approvals/ovl_17_func_800B9158.md
 */

#if 0
/* Best non-matching attempt, preserved for the next session. */
#include "common.h"

void ovl_17_func_800B9158(s32 arg0, s16 arg1) {
    u8 *base;
    u8 *p;

    base = D_800BD848;
    if (*(s16 *)(base + 0x5A8) >= 0x5A) {
        *(s16 *)(base + 0x5A8) = 0;
    }
    p = base + *(s16 *)(base + 0x5A8) * 8;
    *(s32 *)(p + 0x2D8) = arg0;
    *(s16 *)(p + 0x2DC) = arg1;
    *(u16 *)(base + 0x5A8) = *(u16 *)(base + 0x5A8) + 1;
}
#endif
