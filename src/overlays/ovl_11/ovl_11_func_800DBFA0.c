#include "common.h"

void ovl_11_func_800DBFA0(void) {
    char *far_base;

    far_base = (char *)&D_8007AFF0;
    *(s32 *)(far_base + 0x25390) = 0;
    *(s32 *)(far_base + 0x25484) = 0xFFFF;
    *(s32 *)(far_base + 0x25488) = 0xFFFF;
}
