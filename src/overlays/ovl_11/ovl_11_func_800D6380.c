#include "common.h"
#include "game_types.h"

s32 ovl_11_func_800F2354(s32 arg0, s32 arg1);

s32 ovl_11_func_800D6380(s8 arg0, s8 arg1, s32 arg2, Recon_ovl_11_func_800D6380_A3View *arg3) {
    s32 callRet2;
    s32 __ret;
    callRet2 = ovl_11_func_800F2354(arg0, arg1);
    if (((s32)arg3) == 0) {
        __ret = 1;
    } else {
        arg3->unk0 = callRet2;
        __ret = 1;
    }
    return __ret;
}
