#include "common.h"

s32 ovl_11_func_800E63C8(s16 arg0, s16 arg1) {
    if (arg0 != 0) {
        char *base = (char *)&D_8006C838;
        *(s32 *)(base + 0x5234) &= 0xFF7FFBFF;
        *(s32 *)(base + 0x000C) &= 0xFFBFFFFF;
        if (*(s16 *)(base + 0x52C6) != 1 && *(s16 *)(base + 0x52C6) != 6) {
            *(u16 *)(base + 0x51FE) |= 0x0008;
        } else {
            char *clear = (char *)&D_8006C838;
            *(u16 *)(clear + 0x51FE) &= 0xFFF7;
        }
    } else {
        char *set = (char *)&D_8006C838;
        *(s32 *)(set + 0x5234) |= 0x00800000;
    }
    if (arg1 == 0) {
        char *tail = (char *)&D_8006C838;
        *(s32 *)(tail + 0x5234) &= 0xFFFFFFFD;
    }
    return 1;
}
