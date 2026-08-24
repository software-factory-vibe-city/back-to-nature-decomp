#include "common.h"

extern s16 D_80125F24[];

s32 ovl_11_func_800C0F84(void) {
    char *far_base = (char *)&D_8007AFF0;
    char *p = *(char **)(far_base + 0x25388);
    s16 idx = *(s16 *)(p + 2);

    return D_80125F24[idx] == 0x1000;
}
