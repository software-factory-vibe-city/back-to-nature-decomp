#include "common.h"
#include "game_types.h"

void ovl_11_func_800C9E90(s32 arg0, s32 arg1, s32 arg2, s32 arg3);

s32 ovl_11_func_800D037C(s32 arg0, s32 arg1, s32 arg2, s32 arg3) {
    if ((arg0 & 0x1000) == 0) {
        ovl_11_func_800C9E90(arg1, arg2, arg3, ((u32)arg0) >> 0x1F);
    } else {
        return arg0 & 0x1000;
    }
}
