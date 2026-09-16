#include "common.h"
#include "game_types.h"

s32 ovl_11_func_800D2594(Recon_ovl_11_func_800D2594_A0View *arg0, s32 arg1) {
    s32 d;
    s32 result;

    result = 1;
    d = 0x190 / arg1 / 2;
    if (0x190 % arg1 != 0) {
        d += 2;
    }
    d = 0xC8 / d;
    if ((arg0->unk34 & 0x400000) == 0) {
        if (arg0->unk3C < -0xC8) {
            arg0->unk4C = d;
            arg0->unk34 = arg0->unk34 | 0x400000;
        } else {
            arg0->unk4C = -d;
        }
    } else {
        arg0->unk4C = d;
        if (arg0->unk3C + d >= 0) {
            arg0->unk4C = 0;
            arg0->unk3C = 0;
            arg0->unk34 &= 0xFEFFFFFF;
            arg0->unk34 &= 0xFFBFFFFF;
            result = 0;
        }
    }
    return result;
}
