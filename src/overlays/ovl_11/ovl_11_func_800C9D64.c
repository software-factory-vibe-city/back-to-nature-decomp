#include "common.h"

s32 ovl_11_func_800C9D64(void) {
    char *far_base = (char *)&D_8007AFF0;
    s32 var_v0;

    var_v0 = (*(s16 *)(far_base + 0x25476) != 1) * 2;
    if (*(s16 *)(far_base + 0x25476) == 6) {
        var_v0 = 1;
    }
    return var_v0;
}
