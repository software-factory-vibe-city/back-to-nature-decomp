#include "common.h"

void ovl_11_func_80108A24(void);

s32 ovl_11_func_801084E0(void) {
    char *far_base;
    u8 *base;
    u8 *p;
    s32 i;

    far_base = (char *)&D_8007AFF0;
    if ((u32)(*(s32 *)(*(s32 *)(far_base + 0x25388) + 4) - 0x50) < 4U) {
        return 0;
    }
    ovl_11_func_80108A24();
    i = 0;
    base = D_80074838;
    p = base + 0x67A2;
    for (; i < 9; i++) {
        if ((u32)(p[i] - 1) < 3U) {
            D_8012D050[2].field_0 = (s16)(i + 0x258);
            D_8012D050[2].field_2 = 2;
            return 1;
        }
    }
    return 0;
}
