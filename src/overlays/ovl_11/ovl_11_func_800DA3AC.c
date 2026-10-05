#include "common.h"

s32 func_80012A34(s32 arg0);

void ovl_11_func_800DA3AC(Ovl11D124Entry *arg0) {
    s16 temp;

    switch (D_80070CF2) {
    case 1:
        temp = 0x40;
        break;
    case 0:
        temp = 0x80;
        break;
    case 2:
        temp = 0x80;
        break;
    case 3:
        temp = 0;
        break;
    default:
        temp = 0;
        break;
    }
    if (temp != 0) {
        if ((u32)(arg0->unk0 - 0x167) < 3) {
            if (func_80012A34(temp) == 0) {
                arg0->unk0 = 0x40;
                arg0->unk2 = 0x167;
            }
        }
    }
}
