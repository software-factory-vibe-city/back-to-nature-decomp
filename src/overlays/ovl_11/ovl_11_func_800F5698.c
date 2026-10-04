#include "common.h"

typedef struct {
    /* 0x00 */ u8 pad0[2];
    /* 0x02 */ u16 unk2;
    /* 0x04 */ u16 unk4;
    /* 0x06 */ u8 pad6[0x18 - 0x06];
} Ovl11Func5700Entry;

Ovl11Func5700Entry *ovl_11_func_800F5700(s16 arg0, Ovl11Func5700Entry arg1[], s32 arg2);

void ovl_11_func_800F5698(s16 arg0, Ovl11Func5700Entry arg1[], s32 arg2, s32 arg3, s32 arg4) {
    Ovl11Func5700Entry *v1;

    v1 = ovl_11_func_800F5700(arg0, arg1, arg2);
    if (v1 != 0) {
        if (arg3 & arg4) {
            v1->unk4 |= 1;
        } else {
            v1->unk4 &= 0xFFFE;
        }
    }
}
