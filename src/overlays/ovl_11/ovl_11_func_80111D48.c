#include "common.h"

extern u16 D_80127F68[];
extern s32 D_8012D0EC;

void ovl_11_func_800DCBDC(s16 arg0, void *arg1);

void ovl_11_func_80111D48(void) {
    u16 temp[3];

    temp[0] = D_80127F68[0];
    temp[1] = D_80127F68[2];
    temp[2] = D_80127F68[4];
    D_8012D0EC = 0;
    ovl_11_func_800DCBDC(0, temp);
}
