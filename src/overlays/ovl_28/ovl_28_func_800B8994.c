#include "common.h"

void ovl_28_func_800B8994(s16 arg0) {
    s32 i;

    i = 0;
    while (i < 0x14 && D_800B9630[i].unk0 != 0) {
        i += 1;
    }
    if (i != 0x14) {
        D_800B9630[i].unk0 = 1;
        D_800B9630[i].unk4 = arg0;
        D_800B9630[i].unk8 = VWD0 << 0xC;
    }
}
