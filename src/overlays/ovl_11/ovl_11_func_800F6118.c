#include "common.h"

s32 ovl_11_func_800F6118(s32 arg0, s32 *arg1, s32 *arg2) {
    s32 var_a3;
    s32 state;
    Recon_ovl_11_func_800F6118_D80126E18Entry *temp_v1;

    var_a3 = 1;
    state = D_80070CF2;
    *arg1 = 0;
    *arg2 = 0;
    if ((u32) state >= 4U) {
        return 0;
    }
    temp_v1 = &D_80126E18[state];
    switch (arg0) {
    case 0x83:
        *arg2 = (s32) temp_v1->unk0;
        break;
    case 0x57:
        *arg2 = 0x12;
        break;
    case 0x64:
        *arg2 = (s32) temp_v1->unk1;
        break;
    case 0x65:
        *arg2 = (s32) temp_v1->unk2;
        break;
    case 0x122:
    case 0x123:
    case 0x124:
        *arg2 = (s32) temp_v1->unk3;
        break;
    case 0xE8:
        *arg2 = (s32) temp_v1->unk4;
        break;
    default:
        var_a3 = 0;
        break;
    }
    return var_a3;
}
