#include "common.h"

extern u16 D_80128D78;

typedef struct Unk800D3FEC {
    /* 0x00 */ u8 pad[0xAC];
    /* 0xAC */ u16 unkAC;
} Unk800D3FEC;

s32 ovl_11_func_800D3FEC(Unk800D3FEC *arg0) {
    s32 temp;
    s32 var;

    temp = arg0->unkAC - D_80128D78;
    arg0->unkAC = temp;
    if ((s16)temp < 0) {
        var = 0;
    } else {
        var = temp;
    }
    arg0->unkAC = var;
    return 0;
}
