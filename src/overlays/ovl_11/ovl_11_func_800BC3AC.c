#include "common.h"

extern s32 D_801287F4;

void ovl_11_func_800BC3AC(void) {
    char *far_base = (char *)&D_8007AFF0;
    s32 *counter;

    D_801287F4 = 0;
    *(s32 *)(far_base + 0x2548C) = 0;
    counter = (s32 *)&D_8006C838;
    counter[0x1122] += 1;
}
