#include "common.h"

void ovl_21_func_800BAB28(s16 arg0) {
    if (arg0 != 0) {
        if (arg0 == 7 || arg0 == 9 || arg0 == 20) {
            char *base = (char *)&D_8006C838;
            char *p = base + arg0 * 0x1D4;
            s32 v = *(u16 *)(p + 0x8000 + 0x19EC) + 0x1F4;
            if (v > 0xFE0A) {
                v = 0xFFFF;
            }
            *(u16 *)(p + 0x8000 + 0x19EC) = v;
            return;
        } else {
            char *base = (char *)&D_8006C838;
            char *p = base + arg0 * 0x1D4;
            s32 v = *(s16 *)(p + 0x8000 + 0x19EA) + 0x14;
            if (v >= 0xEB) {
                v = 0xFF;
            }
            *(s16 *)(p + 0x8000 + 0x19EA) = v;
        }
    }
}
