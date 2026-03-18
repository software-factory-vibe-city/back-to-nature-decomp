#include "common.h"

extern u16 D_800559D4[];

u16 func_800245C8(s32 arg0, s32 arg1) {
    register u16 *base __asm__("v0");
    register s32 idx __asm__("v1");
    base = D_800559D4;
    idx = arg1 * 10 + arg0;
    return base[idx];
}
