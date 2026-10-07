#include "common.h"

extern s16 D_800BFE44;

void ovl_25_func_800B83A0(void);

void ovl_25_func_800B8340(void) {
    char *ref;
    s16 *p;

    ref = (char *)&D_800BFE44;
    p = (s16 *)(ref + 0x3D0);
    *(s16 *)(ref + 0x4C8) = -1;
    *(s16 *)(ref + 0x3D0) = 0x1320;
    *(s32 *)(ref + 4) = 0;
    *(s32 *)(ref + 8) = 0;
    p[1] = -0xA;
    p[2] = 0xA4;
    *(s16 *)(ref + 0xE) = 0;
    *(s16 *)(ref + 0x4CA) = -1;
    *(s16 *)(ref + 0x4CC) = 0;
    *(s16 *)(ref + 0xC) = 0;
    ovl_25_func_800B83A0();
}
