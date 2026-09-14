#include "common.h"
#include "game_types.h"

void func_80015840(ObjectState *obj, s8 arg1);

s32 ovl_17_func_800BAFAC(Recon_ovl_17_func_800BAFAC_A0View *arg0, s32 arg1, s32 arg2, s32 arg3) {
    if (arg0->unk24 == 2) {
        return 2;
    } else {
        func_80015840(((void *)(((s32)arg0) + 0x20)), 2);
    }
}
