#include "common.h"

typedef struct {
    u16 field_0;
    u16 field_2;
    u16 field_4;
    char pad_06[0x12];
} Entry_800F4AC0;

void ovl_11_func_800F4AC0(s32 arg0) {
    Entry_800F4AC0 *p;
    char *base;
    s32 n;
    u16 val;

    base = (char *)&D_8006C838;
    base += 0x8000;
    p = *(Entry_800F4AC0 **)(base + 0x5DA4);
    for (n = 0; n < 16; n++) {
        if (arg0 == 1) {
            val = p->field_4 & 0xBFFF;
        } else {
            val = p->field_4 | 0x4000;
        }
        p->field_4 = val;
        p += 1;
    }
}
