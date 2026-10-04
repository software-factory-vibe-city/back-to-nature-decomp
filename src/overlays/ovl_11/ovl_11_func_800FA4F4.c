#include "common.h"

void ovl_11_func_800FA950(s16 arg0, s16 arg1, s16 *arg2, s16 *arg3);
void func_800248B0(s32 arg0, s16 arg1, s16 arg2);

void ovl_11_func_800FA4F4(s32 arg0, s16 arg1, s16 arg2) {
    s16 v0;
    s16 v1;

    ovl_11_func_800FA950(arg1, arg2, &v0, &v1);
    func_800248B0(arg0, (s16)(v0 + 0xC), (s16)(v1 + 0x9));
}
