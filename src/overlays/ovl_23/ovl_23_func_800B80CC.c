#include "common.h"

void func_80013328(s16 arg0);
void func_8001FE34(s32 arg0);

s32 ovl_23_func_800B80CC(void) {
    s32 *base;
    s32 v;

    func_80013328(10);
    func_8001FE34(10);
    base = (s32 *)&D_8006C838;
    v = base[0x448C >> 2] + 1;
    base[0x448C >> 2] = v;
    return v;
}
