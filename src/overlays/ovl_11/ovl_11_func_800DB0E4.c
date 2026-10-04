#include "common.h"

extern u8 D_800A03AC[1];

void ovl_11_func_800DB0E4(void) {
    char *far_base;
    u32 i;

    memset(&D_800A03AC, 0, 0xB4);
    far_base = (char *)&D_8007AFF0;
    for (i = 0; i < 8; i++) {
        *(u16 *)(far_base + 0x253C0 + i * 0x16) = 0xFFFF;
    }
}
