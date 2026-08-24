#include "common.h"

s32 ovl_11_func_800DD1D0(s16 *arg0) {
    char *far_base = (char *)&D_8007AFF0;
    s16 *p = *(s16 **)(far_base + 0x25388);

    if (p[0] == arg0[0] && p[1] == arg0[1])
        return 0;
    return 1;
}
