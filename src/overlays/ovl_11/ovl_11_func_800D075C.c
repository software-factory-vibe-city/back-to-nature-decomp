#include "common.h"
#include "game_types.h"
s32 ovl_11_func_800D29B0(s32 arg0, s32 arg1);

void ovl_11_func_800D2A88(s32 arg0, s32 arg1);

void ovl_11_func_800D075C(s32 arg0, s16 arg1, s32 arg2) {
    if (arg2 == 1) {
        ovl_11_func_800D29B0(arg0, arg1);
    } else {
        ovl_11_func_800D2A88(arg0, arg1);
    }
}
