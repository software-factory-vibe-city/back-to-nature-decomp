#include "common.h"
#include "game_types.h"

s32 ovl_11_func_800E109C(UnkStruct800E109C *arg0);

s32 ovl_11_func_800E0AFC(Recon_ovl_11_func_800E0AFC_A0View *arg0) {
    s32 callRet2;
    callRet2 = ovl_11_func_800E109C(((UnkStruct800E109C *)(((s32)arg0))));
    if (callRet2 == 0) {
        return -1;
    } else {
        if (((u32)arg0->unkB0) < ((u32)14)) {
            return 0x164;
        } else {
            return 0x165;
        }
    }
}
