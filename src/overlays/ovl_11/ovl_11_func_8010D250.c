#include "common.h"
#include "game_types.h"

s32 func_80012A34(s32 arg0);
s32 ovl_11_func_8010CE80(Recon_ovl_11_func_8010CE80_A0View *arg0, s32 arg1);
extern s16 D_80127CEC[];

s32 ovl_11_func_8010D250(Recon_ovl_11_func_8010D250_A0View *arg0) {
    s32 s1 = 0;
    s32 idx = func_80012A34(4);

    if (arg0->unk30 != 0x28) {
        if (arg0->unk26 == 0xF) {
            s1 = 1;
        } else {
            s1 = D_80127CEC[idx];
        }
    }

    if (arg0->unkBE != 0 && arg0->unk26 != 0xF) {
        arg0->unk26 = arg0->unkBE;
        arg0->unk28 = arg0->unkC0;
        arg0->unk2A = arg0->unkC2;
    } else if (s1 != arg0->unk26) {
        ovl_11_func_8010CE80((Recon_ovl_11_func_8010CE80_A0View *)arg0, s1);
    }

    return 0;
}
