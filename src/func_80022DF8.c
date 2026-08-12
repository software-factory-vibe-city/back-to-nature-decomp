#include "common.h"

void func_8001AF70(u16 arg0, u16 arg1);
s32 func_8002261C(s32 arg0, s32 arg1);

u16 D_8005E5BC;
s32 D_8005E5C0;
s32 D_8005E5B4;
s32 D_8005E5C4;
s32 D_8005E5C8;

s32 func_80022DF8(void) {
    func_8001AF70(3, D_8005E5BC);
    if (D_8005E5C0 & 0x08000000) {
        ((struct struct_8006C838_view *)&D_8006C838)->field_0C |= 0x08000000;
    } else {
        ((struct struct_8006C838_view *)&D_8006C838)->field_0C &= 0xF7FFFFFF;
    }
    ((struct struct_8006C838_view *)&D_8006C838)->field_CC = 0;
    if (D_8005E5C4 != -1) {
        func_8002261C(D_8005E5C4, D_8005E5C8);
        D_8005E5C4 = -1;
    } else {
        D_8005E5B4 = 2;
    }
    return 1;
}