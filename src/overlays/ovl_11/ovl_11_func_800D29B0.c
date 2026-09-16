#include "common.h"

typedef struct {
    /* 0x00 */ char pad[0x22];
    /* 0x22 */ u16 unk22;
    /* 0x24 */ char pad2[0x30 - 0x24];
    /* 0x30 */ u16 unk30;
    /* 0x32 */ char pad3[0x38 - 0x32];
    /* 0x38 */ s32 unk38;
    /* 0x3C */ s32 unk3C;
    /* 0x40 */ s32 unk40;
} Unk8029B0;

extern s32 D_80123A2C[][4];

s32 ovl_11_func_800D29B0(Unk8029B0 *arg0, s16 arg1) {
    s16 x = arg1;
    s16 idx;
    s16 j;
    s32 res;

    if (x == -1) {
        idx = 4;
        j = 0;
    } else if (x == -2) {
        idx = 5;
        j = 0;
    } else {
        idx = x / 5;
        j = x % 5;
    }
    arg0->unk38 = D_80123A2C[idx][0];
    arg0->unk3C = D_80123A2C[idx][1];
    arg0->unk40 = D_80123A2C[idx][2] + j * 600;
    arg0->unk22 = (idx & 1) ? 1 : 3;
    res = 5;
    arg0->unk30 = res;
    return res;
}
