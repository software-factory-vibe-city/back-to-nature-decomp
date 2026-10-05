#include "common.h"

s32 func_8001AF44(u32 arg0);
void func_8001F278(s32 arg0, s32 arg1, s32 *arg2, s32 *arg3, s32 *arg4);
void ovl_11_func_800DCBDC(s16 arg0, void *arg1);
void func_8001AF70(u16 arg0, u16 arg1);

extern s32 D_80127F68;
extern s32 D_80127F74;
extern s32 D_8012D0EC;

void ovl_11_func_80111D94(void) {
    s32 sp18[3];
    u16 sp28[3];

    if (func_8001AF44(8U) == 1) {
        func_8001F278(D_8012D0EC, 0x4B0, &D_80127F68, &D_80127F74, sp18);
        sp28[0] = (u16) sp18[0];
        sp28[1] = (u16) sp18[1];
        sp28[2] = (u16) sp18[2];
        ovl_11_func_800DCBDC(0, sp28);
        if (D_8012D0EC >= 0x4B0) {
            func_8001AF70(8U, 0U);
            return;
        }
        D_8012D0EC += 1;
    }
}
