#include "common.h"

INCLUDE_ASM("build/ovl_15/asm/nonmatchings/ovl_15_func_8013345C", ovl_15_func_8013345C);


/* PARKED by /auto_decompilation_loop on 2026-10-07T11:29:16.789Z.
 * Reason: escalation-exhausted.
 * Escalation reached: deepseek-v4-1-flash.
 * The best non-matching attempt is preserved verbatim below, disabled.
 * Findings and the decision needed: notes/human-needed-approvals/ovl_15_func_8013345C.md
 */

#if 0
/* Best non-matching attempt, preserved for the next session. */
#include "common.h"

u8 *ovl_15_func_8013345C(u8 *arg0, s16 arg1, s16 *arg2) {
    u8 *var_a1;
    u8 *var_v1;
    u8 *var_t1;
    s32 var_a3;
    s32 var_a3_2;
    s32 var_a1_2;
    u32 mask;

    var_t1 = 0;
    switch (arg1) {
    case 0:
        var_a3 = 0;
        mask = 0x02000000;
        var_a1 = arg0;
loop_4:
        var_t1 = var_a1;
        if ((*(u16 *)arg0 != 0) || (*(u32 *)(arg0 + 0x34) & mask)) {
            arg0 = arg0 + 0xB4;
            var_a3 += 1;
            var_a1 = var_t1 + 0xB4;
            if (var_a3 >= 0xA) {
                return var_t1;
            }
            goto loop_4;
        }
        *arg2 = var_a3;
        break;
    case 1:
        goto setup_11;
found_11:
        var_t1 = arg0 + (var_a1_2 + 0x708);
        *arg2 = var_a3_2;
        goto done;
setup_11:
        var_a3_2 = 0;
        mask = 0x02000000;
        var_v1 = arg0 + 0x73C;
        var_a1_2 = 0;
loop_11:
        if ((*(u16 *)(var_v1 - 0x34) != 0) || (*(u32 *)var_v1 & mask)) {
            var_v1 = var_v1 + 0xB8;
            var_a3_2 += 1;
            var_a1_2 += 0xB8;
            if (var_a3_2 < 0x14) {
                goto loop_11;
            }
        } else {
            goto found_11;
        }
        break;
    default:
        return var_t1;
    }
done:
    return var_t1;
}
#endif
