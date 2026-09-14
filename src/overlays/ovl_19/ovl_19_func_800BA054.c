#include "common.h"
#include "game_types.h"
s32 ovl_19_func_800BA0A0(s32 arg0, s32 arg1, s32 arg2, s32 arg3);

void ovl_19_func_800BAC40(Ovl19Func800BAC40Arg *arg0, s32 arg1, s32 arg2, s32 arg3);

void ovl_19_func_800BA054(Recon_ovl_19_func_800BA054_A0View *arg0, s32 arg1, s32 arg2, s32 arg3) {
    if (arg0->unk12 < -10) {
        ovl_19_func_800BA0A0(((s32)arg0), arg1, arg2, arg3);
    } else {
        ovl_19_func_800BAC40(((Ovl19Func800BAC40Arg *)(((s32)arg0))), 2, arg0->unk4, arg0->unk6);
    }
}
