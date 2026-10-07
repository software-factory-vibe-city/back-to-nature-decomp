#include "common.h"

extern s16 D_800BFE46;

s32 func_80013394(void);
void ovl_25_func_800B83A0(void);
void func_800132B8(s32 arg0, s32 arg1, s32 arg2);

void ovl_25_func_800BA9F4(void) {
    char *far_base;

    if (func_80013394() == 1) {
        ovl_25_func_800B83A0();
        func_800132B8(0xA, 0, 2);
        far_base = (char *)&D_8007AFF0;
        *(s16 *)(far_base + 0x253B4) = -0x140;
        D_800BFE46 = 6;
    }
}
