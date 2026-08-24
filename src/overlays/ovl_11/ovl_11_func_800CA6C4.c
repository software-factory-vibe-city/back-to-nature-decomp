#include "common.h"

void ovl_11_func_800CA6C4(void *arg0) {
    u32 flags;
    u16 *p;

    flags = *(u32 *) ((u8 *) arg0 + 0x6C);
    p = (u16 *) ((u8 *) arg0 + 0x1A);
    if (flags & 0x18000100) {
        *p = 0;
        return;
    }
    if ((flags & 0x04800000) == 0x04000000) {
        *p = (u16) (*p + 1);
        return;
    }
    *p = 0;
}
