#include "common.h"
extern s16 D_80123E54;

extern s16 D_80123E56;

void ovl_11_func_800DC114(s32 arg0, s32 arg1, s32 arg2);

void ovl_11_func_800DDB64(void) {
    D_80123E54 = 0;
    D_80123E56 = 0x1FF;
    ovl_11_func_800DC114(0, 0xA5, 0xD5);
}
