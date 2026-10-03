#include "common.h"

extern s16 D_800A0494[];

void ovl_11_func_800D6628(void) {
    memset(D_800A0494, 0, 0x24);
    memset((char *)D_800A0494 + 0x24, 0xFF, 0x21C);
}
