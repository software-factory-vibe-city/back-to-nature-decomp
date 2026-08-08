#include "common.h"

s16 D_8005E4C0;
s16 D_8005E4C4;
s32 D_8005E4C8;
s16 D_8005E4D0;

void func_8001B4E4(s32 arg0) {
    struct_8005E870 *ep;
    s32 *p32;
    s16 *p16a;
    s16 *p16b;
    s16 *p16c;
    s32 s4;

    ep = &D_8005E870;
    ep->field_36 = 0;
    ep->field_37 = 0;
    s4 = arg0 << 2;
    p32 = (s32 *)((char *)&D_8005E4C8 + s4);
    *p32 = 0;
    p16a = (s16 *)((char *)&D_8005E4C4 + (arg0 << 1));
    p16b = (s16 *)((char *)&D_8005E4D0 + (arg0 << 1));
    *p16a = 0;
    p16c = (s16 *)((char *)&D_8005E4C0 + (arg0 << 1));
    *p16b = 0;
    *p16c = 0;
}
