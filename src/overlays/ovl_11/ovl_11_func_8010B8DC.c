#include "common.h"

INCLUDE_ASM("build/ovl_11/asm/nonmatchings/ovl_11_func_8010B8DC", ovl_11_func_8010B8DC);


/* PARKED by /auto_decompilation_loop on 2026-10-06T09:53:48.418Z.
 * Reason: escalation-exhausted.
 * Escalation reached: deepseek-v4-1-flash.
 * The best non-matching attempt is preserved verbatim below, disabled.
 * Findings and the decision needed: notes/human-needed-approvals/ovl_11_func_8010B8DC.md
 */

#if 0
/* Best non-matching attempt, preserved for the next session. */
#include "common.h"
#include "game_types.h"

extern u16 D_80070CF8;

s32 func_80012A34(s32 arg0);
s32 ovl_11_func_8010B57C(u16 *arg0, s32 arg1);

s32 ovl_11_func_8010B8DC(Recon_ovl_11_func_8010CE80_A0View *arg0) {
    s32 var_a1;
    s32 var_v1;

    if ((u32)(D_80070CF8 - 6) < 0xF) {
        var_a1 = 1;
        if (arg0->unk26 != 0xF) {
            if (arg0->unk34 & 0x2000) {
                var_v1 = func_80012A34(7);
                var_a1 = 0x11;
            } else if (arg0->unk34 & 0x8000) {
                var_v1 = func_80012A34(2);
                var_a1 = 0x12;
            } else {
                var_v1 = func_80012A34(2);
                var_a1 = 0x12;
            }
            if (var_v1 != 0) {
                if (var_v1 == 1) {
set2:
                    var_a1 = 2;
                }
            }
        }
    } else {
        goto set2;
    }
    if (var_a1 != arg0->unk26) {
        ovl_11_func_8010B57C((u16 *)arg0, var_a1);
    }
    return 0;
}
#endif
