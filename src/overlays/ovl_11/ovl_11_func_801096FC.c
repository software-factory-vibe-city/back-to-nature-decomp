#include "common.h"

INCLUDE_ASM("build/ovl_11/asm/nonmatchings/ovl_11_func_801096FC", ovl_11_func_801096FC);


/* PARKED by /auto_decompilation_loop on 2026-10-07T16:02:38.328Z.
 * Reason: escalation-exhausted.
 * Escalation reached: deepseek-v4-1-flash.
 * The best non-matching attempt is preserved verbatim below, disabled.
 * Findings and the decision needed: notes/human-needed-approvals/ovl_11_func_801096FC.md
 */

#if 0
/* Best non-matching attempt, preserved for the next session. */
#include "common.h"
#include "game_types.h"

s32 ovl_11_func_801096FC(Ovl11Func801096FCArg x) {
    Ovl11RecD749F4 *base;
    s32 result;
    s32 i;
    s32 *flag;
    s32 **out;
    s16 sel;
    s32 r;
    s32 lo0;
    s32 hi0;
    s32 lo1;
    s32 hi1;
    s32 one;
    s32 notmatch;
    s32 mask;

    result = 0;
    i = 0;
    notmatch = 0x12;
    mask = 0x10000;
    base = (Ovl11RecD749F4 *)&D_800749F4;
    flag = x.unk18;
    out = x.unk1C;
    sel = x.unk10;
    r = x.unk14;
    lo0 = x.unk0 - r;
    hi0 = x.unk0 + r;
    lo1 = x.unk8 - r;
    hi1 = x.unk8 + r;
    one = 1;
    do {
        if (base[i].unk0 != 0 && sel == base[i].unk30 && base[i].unk26 != notmatch && lo0 < base[i].unk38 && base[i].unk38 < hi0 && lo1 < base[i].unk40 && base[i].unk40 < hi1) {
            if (base[i].unk34 & mask) {
                *flag = 0;
                *out = &base[i];
                result = 1;
            } else {
                *flag = one;
                *out = &base[i];
                result = 1;
            }
            break;
        }
        i++;
    } while (i < 20);
    return result;
}
#endif
