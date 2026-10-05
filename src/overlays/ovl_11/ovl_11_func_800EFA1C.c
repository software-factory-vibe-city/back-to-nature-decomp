#include "common.h"

s32 ovl_11_func_800EFA1C(s16 arg0) {
    s32 temp_v0;
    char *p;

    temp_v0 = func_8001AF44(0x25U);
    if (temp_v0 == 1) {
        if (func_8001AF44(0xC9U) == temp_v0) {
            return 1;
        }
        p = (char *) &D_8006C838;
        if (*(u8 *) (p + 0x8000 + 0x6642) >= 0x5AU) {
            return 1;
        }
    }
    if (arg0 != 0) {
        if (func_8001AF44(0x20U) == 1) {
            return 1;
        }
    }
    return 0;
}
