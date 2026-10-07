#include "common.h"

extern s16 D_800BFE44;

void ovl_25_func_800B8340(void);

void ovl_25_func_800B82B4(void) {
    char *ref;

    ref = (char *)&D_800BFE44;
    *(s16 *)(ref + 0x0) = 0;
    *(s16 *)(ref + 0x2) = 0;
    ovl_25_func_800B8340();
    *(s16 *)(ref + 0x4D4) = 5;
    *(s16 *)(ref + 0x4D6) = 2;
    *(s16 *)(ref + 0x4D8) = 5;
    *(s16 *)(ref + 0x4DA) = 1;
    *(s16 *)(ref + 0x4DC) = 3;
    *(s16 *)(ref + 0x4D2) = 0xFA0;
    *(s16 *)(ref + 0x4D0) = 0x82;
    *(s16 *)(ref + 0x4E4) = 0x46;
    *(s16 *)(ref + 0x4E2) = 0x140;
    *(s16 *)(ref + 0x4DE) = 0x2AD;
    *(s16 *)(ref + 0x4E0) = 0xA;
    *(s16 *)(ref + 0x4CE) = 0xC8;
}
