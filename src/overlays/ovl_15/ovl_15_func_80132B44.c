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
} Unk80132B44;

extern s32 D_801375F8[][4];

s32 ovl_15_func_80132B44(Unk80132B44 *arg0, s16 arg1) {
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
    arg0->unk38 = D_801375F8[idx][0];
    arg0->unk3C = D_801375F8[idx][1];
    arg0->unk40 = D_801375F8[idx][2] + j * 600;
    arg0->unk22 = (idx & 1) ? 1 : 3;
    res = 5;
    arg0->unk30 = res;
    return res;
}
