#include "common.h"

INCLUDE_ASM("build/ovl_11/asm/nonmatchings/ovl_11_func_800D062C", ovl_11_func_800D062C);


/* PARKED by /auto_decompilation_loop on 2026-10-07T06:45:54.446Z.
 * Reason: escalation-exhausted.
 * Escalation reached: deepseek-v4-1-flash.
 * The best non-matching attempt is preserved verbatim below, disabled.
 * Findings and the decision needed: notes/human-needed-approvals/ovl_11_func_800D062C.md
 */

#if 0
/* Best non-matching attempt, preserved for the next session. */
#include "common.h"
#include "game_types.h"

s32 ovl_11_func_800D0600(s32 arg0, s32 arg1);

u16 ovl_11_func_800D062C(Ovl11RankPair *arg0) {
    /* Static-chain caller frame-address/call-boundary-dead at 0x800D064C; census ovl_11:ovl_11_func_800D062C (paired). */
    /* Static-chain caller frame-address/call-boundary-dead at 0x800D0660; census ovl_11:ovl_11_func_800D062C (paired). */
    auto s32 nested_ovl_11_func_800D0600(s32 arg0, s32 arg1) __asm__("ovl_11_func_800D0600");

    s32 temp_s1;
    s32 second;

    temp_s1 = nested_ovl_11_func_800D0600(arg0->rank38, arg0->rank58);
    second = nested_ovl_11_func_800D0600(arg0->rank40, arg0->rank60);
    return D_80123A00[temp_s1 * 3 + second];
}
#endif
