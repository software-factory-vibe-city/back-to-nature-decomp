#include "common.h"

INCLUDE_ASM("build/ovl_11/asm/nonmatchings/ovl_11_func_800F3EF0", ovl_11_func_800F3EF0);


/* PARKED by /auto_decompilation_loop on 2026-09-15T06:04:38.786Z.
 * Reason: escalation-exhausted.
 * Escalation reached: glm-5-3-flash.
 * The best non-matching attempt is preserved verbatim below, disabled.
 * Findings and the decision needed: notes/human-needed-approvals/ovl_11_func_800F3EF0.md
 */

#if 0
/* Best non-matching attempt, preserved for the next session. */
#include "common.h"

s32 ovl_11_func_800F3EF0(void)
{
    u16 *cnt;
    u16 *pend;
    u16 *src;
    s32 i;

    cnt = D_800711C4;
    if (cnt[0x7E] == 0) {
        return 0;
    }
    pend = cnt + 0x7E;
    src = cnt + 0x7F;
    for (i = 0; i < 25; i++) {
        cnt[i] = cnt[i] + src[i];
        if (cnt[i] >= 1000) {
            cnt[i] = 999;
        }
        src[i] = 0;
    }
    *(s32 *)&cnt[0x1A] += *(s32 *)&pend[0x1A];
    pend[0] = 0;
    *(s32 *)&pend[0x1A] = 0;
    return 1;
}
#endif
