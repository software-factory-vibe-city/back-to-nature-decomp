#include "common.h"

void ovl_11_func_800D0EA4(s32 arg0, s32 arg1) {
    if (arg1 == 1) {
        char *base = (char *)&D_8006C838;
        char *p = base + 0x4AC0;

        *(p + arg0) = 1;
        return;
    }
    {
        char *base = (char *)&D_8006C838;
        char *p = base + 0x4AD6;

        *(p + arg0) = 1;
    }
}
