#include "common.h"

s32 ovl_11_func_800E2718(void *arg0) {
    u16 v;

    if (*(u16 *)arg0 == 0 && (*(u32 *)((char *)arg0 + 0x34) & 0x02000000) == 0) {
        return -1;
    }
    v = *(u16 *)((char *)arg0 + 0xB0);
    if (v < 3) {
        return 0x86;
    }
    if (v < 0xA) {
        return 0x10A;
    }
    return 0x109;
}
