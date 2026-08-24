#include "common.h"

INCLUDE_ASM("build/ovl_11/asm/nonmatchings/ovl_11_func_800E3A3C", ovl_11_func_800E3A3C);


/* PARKED by /auto_decompilation_loop on 2026-08-24T18:00:38.121Z.
 * Reason: escalation-exhausted.
 * Escalation reached: deepseek-v4-flash.
 * The best non-matching attempt is preserved verbatim below, disabled.
 * Findings and the decision needed: notes/human-needed-approvals/ovl_11_func_800E3A3C.md
 */

#if 0
/* Best non-matching attempt, preserved for the next session. */
#include "common.h"

extern void (*D_800B9920[])(void);

void ovl_11_func_800E3A3C(void) {
    char *base;
    s32 idx;
    void (**pp)(void);

    base = (char *)&D_8006C838;
    *(s32 *)(base + 0x522C) = 0;
    *(s32 *)(base + 0x5230) = 0;
    idx = *(s32 *)(base + 0x7A74);
    pp = &D_800B9920[idx];
    (*pp)();
    *(s32 *)(base + 0x4450) &= ~0x20;
}
#endif
