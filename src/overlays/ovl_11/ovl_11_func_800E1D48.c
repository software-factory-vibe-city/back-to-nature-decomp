#include "common.h"
#include "game_types.h"
s32 ovl_11_func_800E1DA8(s32 arg0, s32 arg1);

s32 ovl_11_func_800E1D48(Recon_ovl_11_func_800E1D48_A0View *arg0) {
    arg0->unk34 = arg0->unk34 | 0x800;
    if (((arg0->unk34 | 0x800) & 0x2000) == 0) {
        arg0->unk34 = (arg0->unk34 | 0x800) & -0x801;
        arg0->unk2C = 0x12C;
        return 1;
    } else {
        arg0->unk2E = 0;
        ovl_11_func_800E1DA8(((s32)arg0), ((s32)arg0));
        return 0;
    }
}
