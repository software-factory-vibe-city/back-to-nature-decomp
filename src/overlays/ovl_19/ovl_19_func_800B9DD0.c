#include "common.h"
#include "game_types.h"

void ovl_19_func_800BA0A0(s32 arg0);

void ovl_19_func_800BAC40(Ovl19Func800BAC40Arg *arg0, s32 arg1, s32 arg2, s32 arg3);

s32 ovl_19_func_800B9DD0(Recon_ovl_19_func_800B9DD0_A0View *arg0, s32 arg1, s32 arg2, s32 arg3) {
    ovl_19_func_800BA0A0(((s32)arg0));
    if (arg0->unk6 == 0) {
        ovl_19_func_800BAC40(((Ovl19Func800BAC40Arg *)(((s32)arg0))), 2, arg0->unk4, 0);
    } else {
        return arg0->unk6;
    }
}
