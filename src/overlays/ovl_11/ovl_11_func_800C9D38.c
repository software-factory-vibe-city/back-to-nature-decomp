#include "common.h"

void ovl_11_func_800C9D38(void) {
    char *base = (char *)&D_8006C838;

    *(s32 *)(base + 0x5234) &= 0xBFFFFFFF;
    *(s32 *)(base + 0x52D8) = 0;
    *(s32 *)(base + 0x52DC) = 0;
    *(s32 *)(base + 0x52E0) = 0;
}
