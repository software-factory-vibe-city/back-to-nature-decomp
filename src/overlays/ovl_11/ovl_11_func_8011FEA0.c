#include "common.h"

INCLUDE_ASM("build/ovl_11/asm/nonmatchings/ovl_11_func_8011FEA0", ovl_11_func_8011FEA0);


/* PARKED by /auto_decompilation_loop on 2026-09-09T02:40:30.313Z.
 * Reason: escalation-exhausted.
 * Escalation reached: deepseek-v4-flash.
 * The best non-matching attempt is preserved verbatim below, disabled.
 * Findings and the decision needed: notes/human-needed-approvals/ovl_11_func_8011FEA0.md
 */

#if 0
/* Best non-matching attempt, preserved for the next session. */
#include "common.h"

void ovl_11_func_8011FEA0(s16 arg0, s16 arg1) {
    char *base;
    char *p;

    base = (char *)&D_8006C838;
    p = base + arg0 * 0x1D4;
    if (*(s16 *)(p + 0x8000 + 0x19EA) < 0xFF - arg1) {
        *(s16 *)(p + 0x8000 + 0x19EA) = (s16)(arg1 + *(u16 *)(p + 0x8000 + 0x19EA));
    } else {
        *(s16 *)(p + 0x8000 + 0x19EA) = 0xFF;
    }
}
#endif
