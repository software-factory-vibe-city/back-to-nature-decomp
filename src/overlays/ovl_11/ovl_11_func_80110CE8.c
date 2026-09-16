#include "common.h"

extern s32 D_80127E60[][4];

void ovl_11_func_80110CE8(s32 *dst, s16 arg1) {
    s16 x = arg1;
    s16 idx;
    s16 j;

    if (x == 20) {
        idx = 4;
        j = 0;
    } else if (x == 21) {
        idx = 5;
        j = 0;
    } else {
        idx = x / 5;
        j = x % 5;
    }
    dst[0] = D_80127E60[idx][0];
    dst[1] = D_80127E60[idx][1];
    dst[2] = D_80127E60[idx][2] + j * 600;
}
