#include "common.h"

typedef struct {
    /* 0x00 */ u8 pad0[2];
    /* 0x02 */ u16 unk2;
    /* 0x04 */ u16 unk4;
    /* 0x06 */ u8 pad6[0x18 - 0x06];
} Ovl11Func5700Entry;

Ovl11Func5700Entry *ovl_11_func_800F5700(s16 arg0, Ovl11Func5700Entry arg1[], s32 arg2);

void ovl_11_func_800F45A4(s16 arg0, s32 arg1) {
    Ovl11Func5700Entry *v1;
    s32 *base;
    s32 *base2;

    base = (s32 *)&D_8006C838;
    base2 = base + (0x8000 >> 2);
    v1 = ovl_11_func_800F5700(arg0, (Ovl11Func5700Entry *)base2[0x5DB4 >> 2], 13);
    if (v1 != 0) {
        if (arg1 == 1) {
            v1->unk4 |= 1;
        } else {
            v1->unk4 &= 0xFFFE;
        }
    }
}
