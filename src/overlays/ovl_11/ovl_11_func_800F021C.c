#include "common.h"

s32 ovl_11_func_800F021C(s16 arg0) {
    if (arg0 == 0x3A || arg0 == 0x40 || arg0 == 0x3E || arg0 == 0x3F ||
        arg0 == 0x175 || arg0 == 0x3C || arg0 == 0x3B || arg0 == 0x16F ||
        arg0 == 0x16C || arg0 == 0x170 || arg0 == 0x16D || arg0 == 0x171 ||
        arg0 == 0x16E || arg0 == 0x3D || arg0 == 0x172 || arg0 == 0x173 ||
        arg0 == 0x174 || arg0 == 0x167) {
        return 0;
    }
    return 1;
}
