#include "common.h"

s32 func_8002437C(s32 arg0, s32 arg1, s32 arg2) {
    s32 temp;

    if (arg1 != 5) {
        goto _800243C0;
    }
    temp = arg0 - 1;
    if ((u32) temp < 4U) {
        if (arg2 == 0) {
            goto _800243C8;
        }
        return 5;
    }
_800243A4:
    temp = arg0 - 6;
    if ((u32) temp < 7U) {
        if (arg2 == 0) {
            return 5;
        }
        return 0xD;
    }
_800243C0:
    return arg0;
_800243C8:
    return 0;
}

__asm__(
    ".global _800243A4\n"
    "_800243A4 = func_8002437C + 0x28\n"
    ".global _800243C0\n"
    "_800243C0 = func_8002437C + 0x44\n"
    ".global _800243C8\n"
    "_800243C8 = func_8002437C + 0x4c\n"
);
