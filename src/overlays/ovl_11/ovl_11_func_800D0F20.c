#include "common.h"

INCLUDE_ASM("build/ovl_11/asm/nonmatchings/ovl_11_func_800D0F20", ovl_11_func_800D0F20);


/* PARKED by /auto_decompilation_loop on 2026-10-07T07:13:59.748Z.
 * Reason: escalation-exhausted.
 * Escalation reached: deepseek-v4-1-flash.
 * The best non-matching attempt is preserved verbatim below, disabled.
 * Findings and the decision needed: notes/human-needed-approvals/ovl_11_func_800D0F20.md
 */

#if 0
/* Best non-matching attempt, preserved for the next session. */
#include "common.h"
#include "game_types.h"

s32 ovl_11_func_800D0F20(s32 arg0, s32 arg1) {
    s16 *slot;
    s32 *p;
    s32 idx;
    s16 val;

    idx = arg0 + 2;
    if (ovl_11_func_800D0BC8(idx) != 0) {
        return 0x1E6;
    }
    p = ovl_11_func_800D0CD8();
    if (p != 0) {
        *(s32 *)((u8 *)p + 0x34) |= 0x02000000;
        val = ovl_11_func_800E2934(p);
        slot = (s16 *)D_8006C838;
        slot = (s16 *)((u8 *)slot + idx * 4);
        slot[0x4CE4] = val;
        slot = slot + 1;
        slot[0x4CE4] = arg1;
        return 0;
    }
    return 0x1A1;
}
#endif
