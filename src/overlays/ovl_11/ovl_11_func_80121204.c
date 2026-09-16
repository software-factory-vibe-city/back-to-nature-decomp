#include "common.h"

INCLUDE_ASM("build/ovl_11/asm/nonmatchings/ovl_11_func_80121204", ovl_11_func_80121204);


/* PARKED by /auto_decompilation_loop on 2026-09-16T07:15:23.727Z.
 * Reason: escalation-exhausted.
 * Escalation reached: glm-5-3-flash.
 * The best non-matching attempt is preserved verbatim below, disabled.
 * Findings and the decision needed: notes/human-needed-approvals/ovl_11_func_80121204.md
 */

#if 0
/* Best non-matching attempt, preserved for the next session. */
#include "common.h"

s32 ovl_11_func_80121204(void) {
    char *base;
    s16 *p;
    s16 prev;
    s16 cur;
    s16 rem;
    s32 ret;
    u32 i;

    base = (char *)&D_8006C838;
    rem = (*(s16 *)(base + 0x44BA) * 30 + *(s16 *)(base + 0x44BC) + 20) % 120;
    i = 0;
    prev = -1;
    p = &D_801287CC[0];
    ret = 0x1BD0000;
    cur = *p;
    while (1) {
        if (prev < rem && cur >= rem) {
            return ret >> 16;
        }
        p++;
        i++;
        if (i >= 13) {
            return 0x1BD;
        }
        ret += 0x10000;
        prev = cur;
        cur = *p;
    }
}
#endif
