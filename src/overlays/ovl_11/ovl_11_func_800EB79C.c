#include "common.h"

s32 ovl_11_func_800EB79C(s32 arg0, s32 arg1, s32 arg2) {
    s32 idx;
    char *base;
    s32 val;
    char *ptr;
    u16 result;

    idx = (s16)arg0;
    arg1 = (s16)arg1;
    if (arg2 != 0) {
        val = D_80129560[idx];
    } else {
        val = idx;
    }
    base = (char *)&D_8006C838;
    ptr = base + val * 468;
    result = *(u16 *)(ptr + 0x9A08) & 0x3FFF;
    *(u16 *)(ptr + 0x9A08) = result;
    switch (arg1) {
    case 0:
        *(u16 *)(ptr + 0x9A08) = result | 0x8000;
        break;
    case 1:
        break;
    case 2:
        *(u16 *)(ptr + 0x9A08) = result | 0x4000;
        break;
    }
    return 1;
}
