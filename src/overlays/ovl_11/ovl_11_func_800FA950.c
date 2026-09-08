#include "common.h"

void ovl_11_func_800FA950(s16 arg0, s16 arg1, s16 *arg2, s16 *arg3) {
    *arg2 = (((arg0 + arg1) % 7) * 0x29) + 0x1E;
    *arg3 = (((arg0 + arg1) / 7) * 0xE) + 0x50;
}
