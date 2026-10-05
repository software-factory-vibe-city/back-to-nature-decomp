#include "common.h"

void ovl_11_func_800DA454(u16 *arg0, s32 arg1);

void ovl_11_func_800D8FC8(s32 arg0) {
    s32 var_s3;
    s32 i;
    s32 j;
    s32 k;
    u8 *base;
    u16 *p;

    var_s3 = 0x10;
    if (arg0 == 0) {
        var_s3 = 0x20;
    }
    i = 0;
    base = (u8 *) D_80071DFC;
    do {
        k = i + 1;
        p = (u16 *) (base + i * 0x168);
        for (j = 0x2C; j >= 0; j--) {
            ovl_11_func_800DA454(p, var_s3);
            p += 4;
        }
        i = k;
    } while (i < 0x19);
}
