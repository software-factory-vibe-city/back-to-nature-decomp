#include "common.h"

extern u8 D_80128424[];

s32 ovl_11_func_8011EE40(s16 arg0) {
    s32 i;

    for (i = 0; D_80128424[i] != 0xFF; i += 2) {
        if (arg0 == D_80128424[i]) {
            return D_80128424[i + 1];
        }
    }
    return -1;
}
