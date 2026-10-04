#include "common.h"
u32 func_80012A34(s32 arg0);

s32 ovl_17_func_800B9E34(s32 arg0) {
    u16 temp = (arg0 * 100) / 127;

    return func_80012A34(0x64) < temp;
}
