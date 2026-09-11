#include "common.h"

extern s16 D_80070CF6;

s32 ovl_11_func_800F1C48(s32 arg0) {
    s32 mask = 0;

    switch (D_80070CF6) {
    case 0:
        mask = 0x4000000;
        break;
    case 1:
        mask = 0x2000000;
        break;
    case 2:
        mask = 0x1000000;
        break;
    case 3:
        mask = 0x800000;
        break;
    case 4:
        mask = 0x400000;
        break;
    case 5:
        mask = 0x200000;
        break;
    case 6:
        mask = 0x100000;
        break;
    }

    return (mask & arg0) != 0;
}