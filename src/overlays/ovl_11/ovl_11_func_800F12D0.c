#include "common.h"

extern s32 D_80070C88;

void *ovl_11_func_800DBC04(s32 arg0);

s32 ovl_11_func_800F12D0(s32 arg0, s32 arg1) {
    u16 temp_s0;
    char *temp_a1;
    char *far_base;

    temp_s0 = arg0 & 0xFFFF;
    if ((D_80070C88 & 1) && (temp_s0 < 0x12C)) {
        return 1;
    }
    temp_a1 = ovl_11_func_800DBC04(0);
    if (temp_a1 != 0) {
        *(u16 *)(temp_a1 + 2) = temp_s0;
        *(u16 *)(temp_a1 + 6) = arg1;
        far_base = (char *)&D_8007AFF0;
        *(u16 *)(temp_a1 + 4) = *(u16 *)(far_base + 0x25476);
        return 0;
    }
    return 1;
}
