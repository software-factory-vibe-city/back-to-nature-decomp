#include "common.h"

/* Tentative definitions for GP-relative globals owned by this TU. */
s16 D_8005E3E8[2];
s32 D_8005E3EC;

void func_80014494(s32 arg0, s32 arg1, s32 arg2) {
    u8 act0;
    u8 act1;

    act0 = arg0 & 0xFF;
    act1 = arg1 & 0xFF;

    if (D_8005E3E8[arg2] == 0) {
        D_8005EA18[arg2][0] = 0x40;
        D_8005EA18[arg2][1] = (act0 > 0);
        if (act1 != 0) {
            D_8005EA18[arg2][1] = 1;
        }
        D_8005EA18[arg2][2] = 0;
    } else {
        D_8005EA18[arg2][1] = (act0 > 0);
        D_8005EA18[arg2][2] = act1;
    }

    if (D_8005E3EC == 0) {
        memset(D_8005EA18, 0, 0x10);
    }
}
