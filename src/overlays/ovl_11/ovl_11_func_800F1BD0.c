#include "common.h"

s32 ovl_11_func_800F1BD0(s32 arg0) {
    s32 mask = 0;

    switch (D_80070CF2) {
    case 0:
        mask = 0x40000000;
        break;
    case 1:
        mask = 0x20000000;
        break;
    case 2:
        mask = 0x10000000;
        break;
    case 3:
        mask = 0x08000000;
        break;
    }
    return (mask & arg0) != 0;
}
