#include "common.h"

void func_800132F0(s32 arg0, s32 arg1, s32 arg2);
void func_8001FE34(s32 arg0);

s32 ovl_27_func_800B8C6C(void) {
    s32 *base;
    s32 v;

    func_800132F0(10, 0, 2);
    func_8001FE34(10);
    base = (s32 *)&D_8006C838;
    v = base[0x4488 >> 2] + 1;
    base[0x4488 >> 2] = v;
    return v;
}
