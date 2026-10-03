#include "common.h"

s32 ovl_11_func_800E4B58(s32 arg0, s32 arg1);

s32 ovl_11_func_800E4B6C(s32 arg0, s32 arg1) {
    s32 off;
    s32 addr;

    off = (*(s16 *)(arg0 + 2) << 2) + 0x38;
    addr = arg0 + off;
    return addr + ovl_11_func_800E4B58(arg0, arg1);
}
