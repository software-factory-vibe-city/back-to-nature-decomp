#include "common.h"
#include "game_types.h"

s32 ovl_11_func_800DF4F0(UnkStruct800DF4F0 *arg0);

s32 ovl_11_func_800DEEE0(Recon_ovl_11_func_800DEEE0_A0View *arg0, s32 arg1, s32 arg2, s32 arg3) {
    s32 callRet2;
    callRet2 = ovl_11_func_800DF4F0(((UnkStruct800DF4F0 *)(((s32)arg0))));
    if (callRet2 == 0) {
        return -1;
    } else {
        if (((u32)arg0->unkB0) < ((u32)14)) {
            return 0x160;
        } else {
            if (((u32)arg0->unkB0) < ((u32)0x1C)) {
                return 0x161;
            } else {
                return 0x162;
            }
        }
    }
}
