#include "common.h"

extern s16 D_80070CF8;

typedef struct Unk800D3D2C {
    /* 0x00 */ u16 unk0;
    /* 0x02 */ u8 pad[0xAA];
    /* 0xAC */ s16 unkAC;
} Unk800D3D2C;

s32 ovl_11_func_800D3D2C(Unk800D3D2C *arg0) {
    s32 var_a1;

    var_a1 = 0x14;
    if ((D_80070CF8 < 7) || (arg0->unkAC <= 0)) {
        var_a1 = 0x13;
    }
    return var_a1;
}
