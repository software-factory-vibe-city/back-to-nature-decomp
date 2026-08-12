#include "common.h"
#include "include_asm.h"

INCLUDE_ASM("build/asm/nonmatchings/func_8001A870", func_8001A870);


/* PARKED by /auto_decompilation_loop on 2026-08-12T05:17:54.153Z.
 * Reason: escalation-exhausted.
 * Escalation reached: gpt-5.6-sol.
 * The best non-matching attempt is preserved verbatim below, disabled.
 * Findings and the decision needed: notes/human-needed-approvals/func_8001A870.md
 */

#if 0
/* Best non-matching attempt, preserved for the next session. */
#include "common.h"

s16 *func_8001A970(s32 arg0, s16 *arg1, s32 arg2);

s16 *func_8001A870(s32 arg0, s16 *arg1, s32 arg2) {
    s16 *p;

    p = func_8001A970(arg0, arg1, arg2 - 1);
    *(u16 *)p = 0xFFFF;
    if ((u16)*arg1 != 0xFFD) {
        return arg1;
    }
    do {
        arg1++;
    } while ((u16)*arg1 == 0xFFD);
    return arg1;
}
#endif
