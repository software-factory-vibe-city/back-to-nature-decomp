#include "common.h"

INCLUDE_ASM("build/ovl_11/asm/nonmatchings/ovl_11_func_80103770", ovl_11_func_80103770);


/* PARKED by /auto_decompilation_loop on 2026-09-09T01:34:58.129Z.
 * Reason: escalation-exhausted.
 * Escalation reached: deepseek-v4-flash.
 * The best non-matching attempt is preserved verbatim below, disabled.
 * Findings and the decision needed: notes/human-needed-approvals/ovl_11_func_80103770.md
 */

#if 0
/* Best non-matching attempt, preserved for the next session. */
#include "common.h"

s32 ovl_11_func_80103770(void) {
    char *var_v1;
    char *base = (char *)&D_8006C838;
    s32 var_a0;
    s32 var_a2;
    u16 var_a1;
    s16 temp_v0;

    var_a2 = 0;
    var_a1 = 2;
    if (*(s16 *)(base + 0xE514) != 3) {
        var_a1 = *(u16 *)(base + 0xE514);
    }
    var_v1 = base + 0xE522 + var_a1 * 0x54;
    var_a0 = 5;
    do {
        temp_v0 = *(s16 *)var_v1;
        var_v1 += 0xE;
        var_a0 -= 1;
        var_a2 += temp_v0;
    } while (var_a0 >= 0);
    return var_a2 == 0;
}
#endif
