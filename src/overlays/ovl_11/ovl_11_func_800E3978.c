#include "common.h"

s32 ovl_11_func_800E3978(s32 arg0) {
    arg0 -= 0x15F;
    if ((u32)arg0 >= 0x32) {
        return 0;
    }
    return _D_801247E8[arg0 + 1] - _D_801247E8[arg0];
}
