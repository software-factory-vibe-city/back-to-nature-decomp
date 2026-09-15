#include "common.h"

extern struct struct_8006C838 D_8006C838[];

s32 ovl_11_func_800F1CC4(s32 arg0) {
    char *base;
    s32 mask;

    mask = arg0 & 0xC3800;
    if (mask == 0xC3800) {
        return 1;
    }

    base = (char *)D_8006C838;
    mask = 0;
    switch (*(s16 *)(base + 0xE4C8)) {
    case 0:
        mask = 0x80000;
        break;
    case 2:
        mask = 0x40000;
        break;
    case 1:
        mask = 0x2000;
        break;
    case 3:
        mask = 0x1000;
        break;
    case 4:
        mask = 0x800;
        break;
    }

    return (mask & arg0) != 0;
}
