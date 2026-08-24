#include "common.h"

s32 ovl_11_func_800D0ED0(s32 arg0, s32 arg1) {
    if (arg1 == 1) {
        char *base = (char *)&D_8006C838;
        char *p = base + 0x4AC0;

        if (*(p + arg0) != 0) {
            return 1;
        }
    } else {
        char *base = (char *)&D_8006C838;
        char *p = base + 0x4AD6;

        if (*(p + arg0) != 0) {
            return 1;
        }
    }

    return 0;
}
