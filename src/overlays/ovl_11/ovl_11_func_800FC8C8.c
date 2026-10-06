#include "common.h"

INCLUDE_ASM("build/ovl_11/asm/nonmatchings/ovl_11_func_800FC8C8", ovl_11_func_800FC8C8);


/* PARKED by /auto_decompilation_loop on 2026-10-06T16:26:50.400Z.
 * Reason: escalation-exhausted.
 * Escalation reached: deepseek-v4-1-flash.
 * The best non-matching attempt is preserved verbatim below, disabled.
 * Findings and the decision needed: notes/human-needed-approvals/ovl_11_func_800FC8C8.md
 */

#if 0
/* Best non-matching attempt, preserved for the next session. */
#include "common.h"
#include "game_types.h"

void func_80015EE8(s32 arg0, s32 arg1, s32 arg2, s32 arg3, s16 arg4, s16 arg5);

void ovl_11_func_800FC8C8(void) {
    Ovl11D80127328Entry *var_s0;
    u8 *base;
    s32 var_s6;
    s32 temp_v1;
    s32 var_a1;
    s32 var_s1;
    u32 var_s2;

    var_s2 = 0;
    var_a1 = 0x8C;
    var_s6 = 0xC0;
    base = (u8 *) &D_8006C838;
    var_s0 = D_80127328;
    var_s1 = 0xA40000;
    do {
        if ((*(s32 *) (base + 0x44F8)) & var_s0->unk0) {
            func_80015EE8(D_8005E3C0->field_D8 + 0x68, (s32) D_8012CE88, (s32) var_s0->unk4, 0, (s16) var_a1, (s16) var_s6);
            temp_v1 = var_s1 >> 0x10;
            var_s1 += 0x180000;
            var_a1 = temp_v1;
        }
        var_s2 += 1;
        var_s0 += 1;
    } while (var_s2 < 6U);
}
#endif
