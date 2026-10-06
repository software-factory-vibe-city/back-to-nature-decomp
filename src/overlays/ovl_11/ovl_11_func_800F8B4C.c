#include "common.h"

INCLUDE_ASM("build/ovl_11/asm/nonmatchings/ovl_11_func_800F8B4C", ovl_11_func_800F8B4C);


/* PARKED by /auto_decompilation_loop on 2026-10-06T16:12:16.145Z.
 * Reason: escalation-exhausted.
 * Escalation reached: deepseek-v4-1-flash.
 * The best non-matching attempt is preserved verbatim below, disabled.
 * Findings and the decision needed: notes/human-needed-approvals/ovl_11_func_800F8B4C.md
 */

#if 0
/* Best non-matching attempt, preserved for the next session. */
#include "common.h"

extern s16 D_80126E4A;
extern s16 D_80129FD8[12];
extern u8 D_80051BF0[];

s16 *func_8001A970(s32 arg0, s16 *arg1, s32 arg2);
void func_80017B3C(s32 arg0, s32 arg1, s32 arg2, s32 arg3);

void ovl_11_func_800F8B4C(s32 arg0, s32 arg1) {
    s32 var_a0;

    *(u16 *)func_8001A970(D_80126E4A + 1, &D_80129FD8[0], 1) = 0xFFFF;
    func_80017B3C(arg0, (s32) &D_80129FD8[0], 0x28, 0x6E);
    func_80017B3C(arg0, (s32) ((u8 *) D_80051BF0 + D_80054BBC[0]), 0x35, 0x6E);
    var_a0 = arg1 >> 3;
    if (arg1 < 0) {
        arg1 += 7;
        var_a0 = arg1 >> 3;
    }
    *(u16 *)func_8001A970(var_a0, &D_80129FD8[0], 1) = 0xFFFF;
    func_80017B3C(arg0, (s32) &D_80129FD8[0], 0x42, 0x6E);
}
#endif
