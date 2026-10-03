#include "common.h"

void ovl_25_func_800BBA30(s16 arg0, s16 arg1, s16 arg2) {
    u8 *p0 = (u8 *)&D_8005E5E8[0];
    u8 *p1 = (u8 *)&D_8005E5E8[1];

    p0[0x19] = arg0;
    p0[0x1A] = arg1;
    p0[0x1B] = arg2;
    p1[0x19] = arg0;
    p1[0x1A] = arg1;
    p1[0x1B] = arg2;
    p0[0x18] = 1;
    D_8005E5E8[1].unk18 = 1;
}
