#include "common.h"

extern u16 D_80070D06;
extern s16 D_80125F18[];

void ovl_11_func_800CD0C0(s32 *arg0) {
    s16 *entry;

    entry = &D_80125F18[D_80070D06 * 2];
    arg0[0] = entry[0];
    arg0[2] = entry[1];
    arg0[1] = 0;
}
