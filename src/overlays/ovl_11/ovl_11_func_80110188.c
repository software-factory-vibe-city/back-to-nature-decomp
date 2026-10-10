#include "common.h"
#include "game_types.h"

s32 ovl_11_func_80110188(Ovl11StateArg0 *arg0, s16 arg1, s32 *arg2, s16 arg3) {
    Ovl11StateEntry *var_t3;
    s32 var_t4;
    s32 var_v1;

    var_t4 = 0;
    var_t3 = 0;
    D_80127D90[0].unk8 = 0x92E;
    D_80127DD0[2].unk0 = -0xC8;
    D_80127DD0[2].unk8 = -0x9C4;
    switch (arg1) {
    case 0:
        var_t4 = 1;
        var_t3 = D_80127D90;
        if (D_80070D08 != 0) {
            if (arg0->unk38 < 0) {
                var_t3 = D_80127D90 + 1;
            }
        } else {
            D_80127D90[0].unk8 -= 0x96;
        }
        break;
    case 1:
        var_t4 = 1;
        var_t3 = D_80127DB0;
        if (D_80070D0A != 0 && arg0->unk40 > 0) {
            var_t3 = D_80127DB0 + 1;
        }
        break;
    case 2:
        var_t4 = 3;
        if (D_80070D0A == 0) {
            D_80127DD0[2].unk0 = 0x226;
            D_80127DD0[2].unk8 = -0x960;
        }
        var_t3 = D_80127DD0;
        break;
    case 3:
        var_t4 = 2;
        var_t3 = D_80127E00;
        break;
    case 4:
        var_t4 = 2;
        var_t3 = D_80127E20;
        break;
    case 5:
        var_t4 = 2;
        var_t3 = D_80127E40;
        break;
    }
    var_v1 = 0;
    for (var_v1 = 0; var_v1 < var_t4; var_v1++) {
        if (arg3 == var_t3->unkC) {
            arg2[0] = var_t3->unk0;
            arg2[1] = var_t3->unk4;
            arg2[2] = var_t3->unk8;
            return 1;
        }
        var_t3 += 1;
    }
    return 0;
}
