#include "common.h"

s32 ovl_17_func_800B9E94(s16 arg0) {
    u8 *base;
    s32 *p;
    s32 *q;
    s32 i;
    s32 diff;

    i = 0;
    base = D_800BD848;
    p = (s32 *)(base + 0x38);
    q = (s32 *)((u8 *)p + arg0 * 0x50);
    for (; i < 6; i++) {
        if (i == arg0) {
            continue;
        }
        diff = *(s32 *)((u8 *)p + i * 0x50) - *q;
        if (diff < 0) {
            continue;
        }
        if (diff > 0x59FFF) {
            continue;
        }
        return 1;
    }
    return 0;
}
