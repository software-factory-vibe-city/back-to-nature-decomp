#include "common.h"

typedef struct {
    /* 0x00 */ u8 pad0[2];
    /* 0x02 */ u16 unk2;
    /* 0x04 */ u16 unk4;
    /* 0x06 */ u8 pad6[0x18 - 0x06];
} Ovl11Func5700Entry;

Ovl11Func5700Entry *ovl_11_func_800F5700(s16 arg0, Ovl11Func5700Entry arg1[], s32 arg2) {
    s32 i;
    for (i = 0; i < arg2; i++) {
        if (arg1[i].unk2 == arg0)
            return &arg1[i];
    }
    return 0;
}
