#include "common.h"

void func_80015814(u16 *arg0, s32 arg1);

void ovl_23_func_800BB0E8(void) {
    u8 *p;
    u8 *q;
    u32 base;
    s32 i;

    base = (u32)D_800BFA90;
    q = (u8 *)(base - 0x1D4);
    p = (u8 *)base;
    for (i = 5; i >= 0; i--) {
        func_80015814((u16 *)p, 4);
        func_80015814((u16 *)q, 4);
        q += 0x50;
        p += 0x44;
    }
}
