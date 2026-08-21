#include "common.h"
#include "include_asm.h"

INCLUDE_ASM("build/asm/nonmatchings/func_80017F30", func_80017F30);


/* PARKED by /auto_decompilation_loop on 2026-08-21T21:47:41.155Z.
 * Reason: escalation-exhausted.
 * Escalation reached: deepseek-v4-flash.
 * The best non-matching attempt is preserved verbatim below, disabled.
 * Findings and the decision needed: notes/human-needed-approvals/func_80017F30.md
 */

#if 0
/* Best non-matching attempt, preserved for the next session. */
#include "common.h"
s32 func_80017F30(u16 *pa, u16 *pb, u16 *pc) {
    s32 x, y, z;
    u32 mx;
    s32 r;
    u16 sentinel = 0xFFFF;
    goto body;
top:
    if (x == sentinel) goto out;
    pa++;
    pb++;
    pc++;
body:
    x = *pa;
    y = *pb;
    mx = x & 0xFFFF;
    if (mx == y) {
        r = 0;
        goto top;
    }
    z = *pc;
    if (mx == z) {
        r = 0;
        goto top;
    }
    r = (mx < y) ? -1 : 1;
out:
    return r;
}
#endif
