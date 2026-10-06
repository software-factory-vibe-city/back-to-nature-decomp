#include "common.h"

INCLUDE_ASM("build/ovl_11/asm/nonmatchings/ovl_11_func_800EDF3C", ovl_11_func_800EDF3C);


/* PARKED by /auto_decompilation_loop on 2026-10-06T05:04:43.611Z.
 * Reason: escalation-exhausted.
 * Escalation reached: deepseek-v4-1-flash.
 * The best non-matching attempt is preserved verbatim below, disabled.
 * Findings and the decision needed: notes/human-needed-approvals/ovl_11_func_800EDF3C.md
 */

#if 0
/* Best non-matching attempt, preserved for the next session. */
#include "common.h"

s32 ovl_11_func_800EDF3C(s16 arg0, s32 arg1) {
    s16 var_a0;
    s32 temp_v0;
    char *p;
    s32 off = 0x8000;

    if ((arg1 << 0x10) != 0) {
        var_a0 = D_80129560[arg0];
    } else {
        var_a0 = arg0;
    }
    if (var_a0 == 0xB) {
        goto block_b;
    }
    if (var_a0 == 0x14) {
        temp_v0 = func_8001AF44(0x25U);
        if (temp_v0 == 1) {
            if (D_80070CF2 == temp_v0) {
                goto ret1;
            }
            goto block_7;
        }
    }
    goto ret1;
block_7:
    return 0;
ret1:
    return 1;
block_b:
    if (func_8001AF44(0x129U) == 1) {
        goto block_7;
    }
    p = (char *) &D_8006C838;
    if (*(u8 *) (p + off + 0x6647) != 0xFF) {
        goto block_7;
    }
    goto ret1;
}
#endif
