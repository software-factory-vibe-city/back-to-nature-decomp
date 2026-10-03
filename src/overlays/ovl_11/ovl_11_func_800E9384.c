#include "common.h"

s32 func_8001AF44(u32 arg0);
void func_8001AF70(u16 arg0, u16 arg1);

s32 ovl_11_func_800E9384(s16 arg0, s16 arg1, s32 arg2) {
    if (arg0 == 0) {
        func_8001AF70(arg2 & 0xFFFF, arg1 != 0);
        return 1;
    }
    return func_8001AF44(arg2 & 0xFFFF);
}
