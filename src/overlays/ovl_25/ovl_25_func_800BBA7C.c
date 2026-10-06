#include "common.h"

void func_8001F278(s32 arg0, s32 arg1, s32 *arg2, s32 *arg3, s32 *arg4);
void ovl_25_func_800BBA30(s16 arg0, s16 arg1, s16 arg2);

extern s16 D_800BCD50;
extern s16 D_800BCD52;
extern s32 D_800BCDAC;
extern s32 D_800BCDB8;

void ovl_25_func_800BBA7C(void) {
    s32 sp18[3];
    s16 temp_v0;
    s16 temp_v0_2;

    func_8001F278((s32) D_800BCD52, 0x1FF, &D_800BCDAC, &D_800BCDB8, sp18);
    ovl_25_func_800BBA30(sp18[0], sp18[1], sp18[2]);
    if (D_800BCD50 == 0) {
        D_800BCD52 = D_800BCD52 + 1;
        temp_v0 = D_800BCD52;
        if (temp_v0 >= 0x200) {
            D_800BCD50 = 1;
            D_800BCD52 = 0x1FF;
        }
    } else {
        D_800BCD52 = D_800BCD52 - 1;
        temp_v0_2 = D_800BCD52;
        if (temp_v0_2 < 0) {
            D_800BCD50 = 0;
            D_800BCD52 = 0;
        }
    }
}
