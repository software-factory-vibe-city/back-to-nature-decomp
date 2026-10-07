#include "common.h"

INCLUDE_ASM("build/ovl_11/asm/nonmatchings/ovl_11_func_800D08FC", ovl_11_func_800D08FC);


/* PARKED by /auto_decompilation_loop on 2026-10-07T13:29:45.367Z.
 * Reason: escalation-exhausted.
 * Escalation reached: deepseek-v4-1-flash.
 * The best non-matching attempt is preserved verbatim below, disabled.
 * Findings and the decision needed: notes/human-needed-approvals/ovl_11_func_800D08FC.md
 */

#if 0
/* Best non-matching attempt, preserved for the next session. */
#include "common.h"
#include "game_types.h"

typedef struct {
    s16 unk0;
    s16 unk2;
} Unk800D0DB0;

Unk800D0DB0 *ovl_11_func_800D08FC(s32 arg0) {
    Unk800D0DB0 *ret;
    s16 *ptr;
    s16 *arr;
    s32 i;
    u8 *base;

    ret = 0;
    if (arg0 == 1) {
        arr = D_80076200;
        base = (u8 *)D_8006C838;
        for (i = 0, ptr = arr; i < 2; i++) {
            if (i == 1 && *(u16 *)(base + 0x44D0) == 0) {
                break;
            }
            if (*ptr == -1) {
                ret = (Unk800D0DB0 *)((u8 *)arr + i * 4);
                break;
            }
        }
    } else {
        base = (u8 *)D_8006C838;
        for (i = 2, ptr = (s16 *)(base + 0x99D0); i < 4; i++) {
            if (i == 3 && *(u16 *)(base + 0x44D2) == 0) {
                break;
            }
            if (*ptr == -1) {
                ret = (Unk800D0DB0 *)((u8 *)D_80076200 + i * 4);
                break;
            }
        }
    }
    return ret;
}
#endif
