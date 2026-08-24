#include "common.h"

INCLUDE_ASM("build/ovl_11/asm/nonmatchings/ovl_11_func_800EF870", ovl_11_func_800EF870);


/* PARKED by /auto_decompilation_loop on 2026-08-24T11:56:05.548Z.
 * Reason: escalation-exhausted.
 * Escalation reached: deepseek-v4-flash.
 * The best non-matching attempt is preserved verbatim below, disabled.
 * Findings and the decision needed: notes/human-needed-approvals/ovl_11_func_800EF870.md
 */

#if 0
/* Best non-matching attempt, preserved for the next session. */
#include "common.h"

void ovl_11_func_800EF870(s16 arg0) {
    char *base;
    char *p;

    base = (char *)&D_8006C838;
    p = base + arg0 * 0xC;
    p += 0x8000;
    *(s16 *)(p + 0x64D8) = -1;
    *(s16 *)(p + 0x64DA) = 0;
    *(s16 *)(p + 0x64DC) = 0;
    *(s16 *)(p + 0x64E0) = -1;
    *(s16 *)(p + 0x64E2) = -1;
}
#endif
