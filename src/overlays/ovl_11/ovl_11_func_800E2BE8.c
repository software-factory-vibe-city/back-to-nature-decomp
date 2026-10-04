#include "common.h"

void ovl_11_func_800D075C(s32 arg0, s32 arg1, s32 arg2);

void ovl_11_func_800E2BE8(s32 arg0) {
    s32 i;
    s16 v;

    for (i = 0; i < 10; i++) {
        v = *(s16 *)(arg0 + 0x30);
        if (v != 4 && v != 1) {
            ovl_11_func_800D075C(arg0, (s16)i, 0);
        }
    }
}
