#include "common.h"

s32 ovl_11_func_800D0D7C(u8 *arg0) {
    s32 i;
    u8 *p;

    for (i = 0, p = (u8 *)&D_800749F4; i < 20; i++) {
        if (arg0 == p) {
            return i;
        }
        p += 0xB8;
    }
    return -1;
}
