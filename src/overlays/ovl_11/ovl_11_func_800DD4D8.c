#include "common.h"

INCLUDE_ASM("build/ovl_11/asm/nonmatchings/ovl_11_func_800DD4D8", ovl_11_func_800DD4D8);


/* PARKED by /auto_decompilation_loop on 2026-10-07T09:38:51.479Z.
 * Reason: escalation-exhausted.
 * Escalation reached: deepseek-v4-1-flash.
 * The best non-matching attempt is preserved verbatim below, disabled.
 * Findings and the decision needed: notes/human-needed-approvals/ovl_11_func_800DD4D8.md
 */

#if 0
/* Best non-matching attempt, preserved for the next session. */
#include "common.h"

s32 func_8001AF44(u32 arg0);
void func_8001AF70(u16 arg0, u16 arg1);

void ovl_11_func_800DD4D8(void) {
    auto s32 nested_800DD45C(void *arg0, void *arg1, s32 arg2) __asm__("ovl_11_func_800DD45C");
    void *p = D_80129178.unk0;
    s32 one;
    if (p != 0) {
        one = 1;
        if (D_80129184 == one) goto L1;
        if (D_80129184 == 0) goto L0;
        if (D_80129184 == 2) goto L2;
        if (D_80129184 == 3) goto L3;
    }
    return;
L0:
    if (func_8001AF44(7U) == one) {
        D_80129184 = one;
    }
    return;
L1:
    nested_800DD45C(p, D_80129178.unk4, 2);
    return;
L2:
    nested_800DD45C(D_80129178.unk4, D_80129178.unk8, 3);
    return;
L3:
    if (nested_800DD45C(D_80129178.unk8, p, 0) == one) {
        func_8001AF70(7U, 0U);
    }
    return;
}
#endif
