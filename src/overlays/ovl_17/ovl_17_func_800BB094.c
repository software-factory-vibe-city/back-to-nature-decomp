#include "common.h"
#include "game_types.h"

void func_80015840(ObjectState *obj, s8 arg1);

s32 ovl_17_func_800BB094(Recon_ovl_17_func_800BB094_A0View *arg0) {
    if (arg0->unk24 == 1) {
        return 1;
    } else {
        func_80015840(((void *)(((s32)arg0) + 0x20)), 1);
    }
}
