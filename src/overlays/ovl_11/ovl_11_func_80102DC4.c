#include "common.h"

extern u16 D_801273EE;

s32 ovl_11_func_80102DC4(void *arg0) {
    s32 i = 0;
    s32 mask = 1;
    u16 arg = *(u16 *)((char *)arg0 + 8);

    for (; i < 12; i++, mask = (mask << 1) & 0xFFFE) {
        if (arg & mask) {
            s32 v = D_801273EE;
            if (v & mask) {
                D_801273EE = mask ^ v;
            } else {
                return 0;
            }
        }
    }
    return 1;
}
