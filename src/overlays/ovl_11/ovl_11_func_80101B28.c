#include "common.h"
extern u16 D_801273EE;

s32 ovl_11_func_80101B84(s32 arg0);

s32 ovl_11_func_80101B28(s8 arg0, s32 arg1, s32 arg2, s32 arg3) {
    s32 callRet1;
    if (arg0 < 7) {
        callRet1 = ovl_11_func_80101B84(arg0);
        return ((u32)0) < ((u32)(D_801273EE & callRet1));
    } else {
        return ((u32)0) < ((u32)(D_801273EE & 0xF80));
    }
}
