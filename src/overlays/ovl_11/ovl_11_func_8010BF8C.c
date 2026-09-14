#include "common.h"
#include "game_types.h"
s32 ovl_11_func_8010BFEC(s32 arg0, s32 arg1, s32 arg2, s32 arg3);

s32 ovl_11_func_8010BF8C(Recon_ovl_11_func_8010BF8C_A0View *arg0, s32 arg1, s32 arg2, s32 arg3) {
    arg0->unk34 = arg0->unk34 | 0x800;
    if (((arg0->unk34 | 0x800) & 0x2000) == 0) {
        arg0->unk34 = (arg0->unk34 | 0x800) & -0x801;
        arg0->unk2C = 0x12C;
        return 1;
    } else {
        arg0->unk2E = 0;
        ovl_11_func_8010BFEC(((s32)arg0), ((s32)arg0), arg2, arg3);
        return 0;
    }
}
