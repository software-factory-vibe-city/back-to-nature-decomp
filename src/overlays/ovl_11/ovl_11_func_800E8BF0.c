#include "common.h"

s32 ovl_11_func_800E8BF0(void) {
    char *far_base = (char *)&D_8007AFF0;

    return *(s32 *)(far_base + 0x254A0) == 3;
}
