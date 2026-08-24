#include "common.h"

extern s16 D_80071A8A;

void ovl_11_func_800CF2C8(s32 *arg0) {
    s32 flags = arg0[0xD];

    if ((flags & 0x20000) && (D_80071A8A != *(u16 *)arg0)) {
        arg0[0xD] = flags & 0xFFFDFFFF;
    }
}
