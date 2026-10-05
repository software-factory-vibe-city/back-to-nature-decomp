#include "common.h"

s32 func_80012A34(s32 arg0);
extern u8 D_801232D4[];

s32 ovl_11_func_800D1C18(s32 arg0, s32 arg1, s32 arg2) {
    u16 *ptr;
    u8 *base;
    s32 t0;
    s32 a2;
    s32 a1;
    s32 a3;
    s32 o1;
    s32 o0;

    arg0 &= 0xFFFF;
    arg1 &= 0xFFFF;
    arg2 &= 0xFFFF;

    t0 = func_80012A34(0x65);

    a3 = 4;
    a1 = 0;
    a2 = 0;
    base = D_801232D4;
    o1 = arg1 * 9;
    o0 = arg0 * 288;
    ptr = (u16 *)(((arg2 + o1) * 8) + o0 + base);
    do {
        u16 val = *ptr;

        if (val != 0) {
            a2 += val;
            if (a2 >= t0) {
                a3 = a1 & 0xFFFF;
                break;
            }
        }
        a1++;
        ptr++;
    } while (a1 < 4);
    return a3;
}
