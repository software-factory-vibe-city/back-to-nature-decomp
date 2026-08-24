#include "common.h"

extern s32 D_80128CB4;
extern s32 D_80128CB8;
extern s32 D_80128CBC;
extern s16 D_80128CC0;
extern s16 D_80128CC2;
extern s16 D_80128CC4;
extern s16 D_80128CC6;
extern s16 D_80128CC8;

void ovl_11_func_800C5048(s16 arg0, s16 arg1, s16 arg2, s16 arg3, s16 arg4, s32 arg5) {
    D_80128CB4 = 0;
    D_80128CBC = 0x28;
    D_80128CC4 = arg1;
    D_80128CC6 = arg0;
    D_80128CC0 = arg2;
    D_80128CC2 = arg3;
    D_80128CB8 = arg5;
    D_80128CC8 = arg4;
}
