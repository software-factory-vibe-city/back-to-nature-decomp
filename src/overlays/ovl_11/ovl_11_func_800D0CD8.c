#include "common.h"

s32 *ovl_11_func_800D0CD8(void) {
    s32 *ptr;
    s32 i;
    s32 limit;
    char *base;

    base = (char *)&D_8006C838;
    ptr = 0;
    limit = 5;
    if (*(u16 *)(base + 0x44D2) != 0) {
        limit = 10;
    }
    for (i = 0; i < limit; i++) {
        ptr = (s32 *)((char *)&D_8006C838 + 0x7AB4 + i * 0xB4);
        if (*(u16 *)ptr == 0 && !(*(s32 *)((char *)ptr + 0x34) & 0x02000000)) {
            break;
        }
    }
    if (i == limit) {
        return 0;
    }
    return ptr;
}
