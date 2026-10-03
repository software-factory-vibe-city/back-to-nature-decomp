#include "common.h"

extern u8 D_80128E08[];

void ovl_11_func_800DC990(void) {
    u8 *base;
    s32 i;

    base = D_80128E08;
    for (i = 0xE; i >= 0; i--) {
        ovl_11_func_800DCA10(base);
        base += 0x30;
    }
}
