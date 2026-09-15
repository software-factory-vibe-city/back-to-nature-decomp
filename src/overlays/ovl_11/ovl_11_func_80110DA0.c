#include "common.h"

extern s32 D_80127EC0[][4];

void ovl_11_func_80110DA0(s32 *arg0, s16 arg1) {
    s16 q = arg1 / 5;
    s16 r = arg1 % 5;

    arg0[0] = D_80127EC0[q][0] + r * 0x190;
    arg0[1] = D_80127EC0[q][1];
    arg0[2] = D_80127EC0[q][2];
}
