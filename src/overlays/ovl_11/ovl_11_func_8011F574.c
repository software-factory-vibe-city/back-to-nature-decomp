#include "common.h"

INCLUDE_ASM("build/ovl_11/asm/nonmatchings/ovl_11_func_8011F574", ovl_11_func_8011F574);


/* PARKED by /auto_decompilation_loop on 2026-10-03T21:59:13.217Z.
 * Reason: asm-needs-human-approval.
 * Escalation reached: deepseek-v4-1-flash.
 * The best non-matching attempt is preserved verbatim below, disabled.
 * Findings and the decision needed: notes/human-needed-approvals/ovl_11_func_8011F574.md
 */

#if 0
/* Best non-matching attempt, preserved for the next session. */
#include "common.h"

extern s16 D_80128540;
extern s16 D_8012855A;

void ovl_11_func_8011F52C(void);

char *ovl_11_func_8011F574(void) {
    char *base;
    u16 v;

    ovl_11_func_8011F52C();
    D_80128540 = 1;

    /* Two-stage base formation keeps the +0x8000 materialized at runtime
     * (lui/addiu/ori/addu) instead of folding it into the access offset;
     * same idiom as matched siblings ovl_11_func_800BFD04 /
     * ovl_11_func_800BF2F4. */
    base = (char *)&D_8006C838;
    base += 0x8000;

    v = *(u16 *)(base + 0x64D2);
    *(u16 *)(base + 0x64D2) = 0;
    D_8012855A = v;
    return base;
}
#endif
