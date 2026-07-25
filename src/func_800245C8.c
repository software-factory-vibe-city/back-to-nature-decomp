#include "common.h"

extern u16 D_800559D4[];

u16 func_800245C8(s32 arg0, s32 arg1) {
    u16 *base;
    s32 idx;
    base = D_800559D4;
    idx = arg1 * 10 + arg0;
    return base[idx];
}
