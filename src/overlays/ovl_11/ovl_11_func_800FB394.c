#include "common.h"
#include "game_types.h"

s8 ovl_11_func_800D583C(s16 arg0);

void ovl_11_func_800FB404(s32 arg0, s32 arg1);

s32 ovl_11_func_800FB394(Recon_ovl_11_func_800FB394_A0View *arg0, s32 arg1, s32 arg2, s32 arg3) {
    s32 callRet3;
    callRet3 = ovl_11_func_800D583C(arg0->unk0);
    if (callRet3 == 2) {
        ovl_11_func_800FB404(((s32)arg0), arg2);
        return 0;
    } else {
        return 1;
    }
}
