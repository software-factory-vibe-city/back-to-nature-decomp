#include "common.h"

INCLUDE_ASM("build/ovl_17/asm/nonmatchings/ovl_17_func_800B9324", ovl_17_func_800B9324);


/* PARKED by /auto_decompilation_loop on 2026-10-09T09:38:48.600Z.
 * Reason: escalation-exhausted.
 * Escalation reached: deepseek-v4-1-flash.
 * The best non-matching attempt is preserved verbatim below, disabled.
 * Findings and the decision needed: notes/human-needed-approvals/ovl_17_func_800B9324.md
 */

#if 0
/* Best non-matching attempt, preserved for the next session. */
#include "common.h"
#include "game_types.h"
#include "psyq/stddef.h"
#include "psyq/libgte.h"


s32 ovl_17_func_800B9CE4 (s16 arg0);
s32 ovl_17_func_800B9F44 (s16 arg0);
s32 ovl_17_func_800B9F10 (s16 arg0, s16 arg1);
s32 ovl_17_func_800B9F78 (s16 arg0);
void ovl_17_func_800B9DB8 (s16 arg0);
void ovl_17_func_800B9DE0 (s16 arg0);
s32 ovl_17_func_800B9E94 (s16 arg0);
void ovl_17_func_800B9E0C (s16 arg0);
u32 Rand (s32 arg0);

void ovl_17_func_800B9324(void) {
    s32 var_s4;
    s32 temp_s1;
    s32 temp_s2;
    s32 var_s6;
    s32 var_v0;
    s32 var_v1;
    u8 *base;
    u8 *work;
    u8 *base3;
    u8 *var_s5;

    var_s4 = 0;
    var_s6 = 0;
    base = D_800BD848;
    work = D_80074838;
    var_s5 = base + 0x30;
    do {
        if ((var_s4 != 2) || ((*(s16 *) ((u8 *) work + 0x6514)) != 3)) {
            base3 = D_800BD848;
            if ((*(s32 *) ((u8 *) var_s5 + 0)) == 1) {
                (*(s32 *) ((u8 *) var_s5 + 0)) = 0;
            } else {
                temp_s2 = ovl_17_func_800B9CE4(var_s4);
                temp_s1 = ovl_17_func_800B9F44(var_s4);
                var_v1 = 0;
                if (ovl_17_func_800B9F10(var_s4, *(s16 *) ((u8 *) base3 + 0x16)) == 0) {
                    var_v1 = 4;
                    if (ovl_17_func_800B9F10(var_s4, *(s16 *) ((u8 *) base3 + 0x18)) != 0) {
                        var_v1 = 2;
                    }
                }
                var_v0 = var_v1 * 2;
                if (temp_s1 == 0) {
                    var_v0 = (var_v1 + 1) * 2;
                }
                (*(s32 *) ((u8 *) (base3 + 0x30 + var_s6))) = ovl_17_func_800B9F78(*(s16 *) ((u8 *) (base + var_v0 + (temp_s2 * 0xC) + 0x208)));
            }
        }
        var_s6 += 0x50;
        var_s4 += 1;
        var_s5 += 0x50;
    } while (var_s4 < 6);
}
#endif
