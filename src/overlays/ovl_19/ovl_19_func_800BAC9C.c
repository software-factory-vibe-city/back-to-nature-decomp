#include "common.h"

void ovl_19_func_800BAC9C(s32 arg0) {
    u8 *p;
    s32 i;

    *(u32 *)&D_800BD07C = (u32)(arg0 == 0 ? D_80015814 : D_80015828);

    p = D_800BF570;
    for (i = 2; i >= 0; i--) {
        ((void (*)(u16 *, s32))*(u32 *)&D_800BD07C)((u16 *)p, 4);
        p += 0x40;
    }

    p = D_800BF4E8;
    for (i = 1; i >= 0; i--) {
        ((void (*)(u16 *, s32))*(u32 *)&D_800BD07C)((u16 *)p, 4);
        p += 0x48;
    }
}
