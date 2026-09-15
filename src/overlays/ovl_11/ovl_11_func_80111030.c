#include "common.h"

INCLUDE_ASM("build/ovl_11/asm/nonmatchings/ovl_11_func_80111030", ovl_11_func_80111030);


/* PARKED by /auto_decompilation_loop on 2026-09-15T18:50:42.650Z.
 * Reason: escalation-exhausted.
 * Escalation reached: glm-5-3-flash.
 * The best non-matching attempt is preserved verbatim below, disabled.
 * Findings and the decision needed: notes/human-needed-approvals/ovl_11_func_80111030.md
 */

#if 0
/* Best non-matching attempt, preserved for the next session. */
#include "common.h"

s32 ovl_11_func_80111030(s32 arg0) {
    char *base;
    char *p;

    switch (*(s16 *)(arg0 + 38)) {
    case 8:
        arg0 = *(u16 *)(arg0 + 0xAE);
        break;
    case 9:
        arg0 = *(u16 *)(arg0 + 0xB0);
        break;
    case 10:
        arg0 = *(u16 *)(arg0 + 0xB2);
        break;
    default:
        return 24;
    }

    arg0 = arg0 / 52 * 2;
    base = (char *)&D_8006C838;
    p = base + 0x99DA;
    return *(s16 *)(p + arg0) * 2;
}
#endif
