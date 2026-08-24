#include "common.h"

extern s16 D_8012DB58;

void ovl_11_func_801209A8(void) {
    char *far_base = (char *)&D_8007AFF0;

    *(s32 *)(far_base + 0x2548C) = 3;
    *(s32 *)(far_base + 0x254A0) = 0x17;
    D_8012DB58 = 0;
}
