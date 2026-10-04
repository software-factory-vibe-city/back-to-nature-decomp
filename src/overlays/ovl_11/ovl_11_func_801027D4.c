#include "common.h"

extern u16 D_8012CF00[8];

void *ovl_11_func_80102844(s8 arg0, s8 arg1);

s32 ovl_11_func_801027D4(s8 arg0, s8 arg1) {
    u16 key;
    s32 i;

    key = *(u16 *)ovl_11_func_80102844(arg0, arg1);
    for (i = 0; i < 8; i++) {
        if (D_8012CF00[i] == key) {
            break;
        }
    }
    return i != 8;
}
