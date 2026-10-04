#include "common.h"

INCLUDE_ASM("build/ovl_11/asm/nonmatchings/ovl_11_func_800BF450", ovl_11_func_800BF450);


/* PARKED by /auto_decompilation_loop on 2026-10-04T00:54:33.390Z.
 * Reason: asm-needs-human-approval.
 * Escalation reached: deepseek-v4-1-flash.
 * The best non-matching attempt is preserved verbatim below, disabled.
 * Findings and the decision needed: notes/human-needed-approvals/ovl_11_func_800BF450.md
 */

#if 0
/* Best non-matching attempt, preserved for the next session. */
#include "common.h"
#include "game_types.h"

void *func_8001EF98(void);

register s32 *p asm("$3");

s32 ovl_11_func_800BF450(void) {
    s32 v;
    s32 w;

    p = func_8001EF98();
    D_80128808 = (s32)p;
    if (p == 0) {
        return 1;
    }
    v = *p;
    D_8012880C = v & 0xFFFF;
    if ((v & 0x2000) == 0) {
        p = (s32 *)0x8000;
        w = (s32)p - 0x8000;
        return w;
    }
    return 0;
}
#endif
