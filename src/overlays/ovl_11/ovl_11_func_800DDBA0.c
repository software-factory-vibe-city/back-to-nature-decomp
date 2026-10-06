#include "common.h"

void func_8001F278(s32 arg0, s32 arg1, s32 *arg2, s32 *arg3, s32 *arg4);
void ovl_11_func_800DC114(s32 arg0, s32 arg1, s32 arg2);

extern s16 D_80123E54;
extern s16 D_80123E56;
extern s32 D_80123E58;
extern s32 D_80123E64;

void ovl_11_func_800DDBA0(void) {
    s32 sp18[3];
    s16 temp_v0;
    s16 temp_v0_2;

    func_8001F278((s32) D_80123E56, 0x1FF, &D_80123E58, &D_80123E64, sp18);
    ovl_11_func_800DC114(sp18[0], sp18[1], sp18[2]);
    if (D_80123E54 == 0) {
        D_80123E56 = D_80123E56 + 1;
        temp_v0 = D_80123E56;
        if (temp_v0 >= 0x200) {
            D_80123E54 = 1;
            D_80123E56 = 0x1FF;
        }
    } else {
        D_80123E56 = D_80123E56 - 1;
        temp_v0_2 = D_80123E56;
        if (temp_v0_2 < 0) {
            D_80123E54 = 0;
            D_80123E56 = 0;
        }
    }
}
