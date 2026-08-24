#include "common.h"

typedef struct {
    u16 field_0;
    u16 field_2;
    u16 field_4;
    char pad_06[0x12];
} Entry_800F4B14;

s32 ovl_11_func_800F4B14(void) {
    s32 count;
    Entry_800F4B14 *p;
    char *base;
    s32 n;

    base = (char *)&D_8006C838;
    base += 0x8000;
    p = *(Entry_800F4B14 **)(base + 0x5DA4);
    count = 0;
    n = 0xF;
    do {
        if (!(p->field_4 & 0x4000)) {
            count += 1;
        }
        p += 1;
        n -= 1;
    } while (n >= 0);
    return count;
}
