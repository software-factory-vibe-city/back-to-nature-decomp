#include "common.h"
s32 ovl_11_func_800E4C84(s32 arg0);

s32 ovl_11_func_800E4B58(s32 arg0, s32 arg1);

s32 ovl_11_func_800E4C30(s32 arg0) {
    s32 callRet3;
    s32 callRet4;
    s32 callRet5;
    callRet3 = ovl_11_func_800E4C84(arg0);
    callRet4 = ovl_11_func_800E4B58(arg0, ((s16)callRet3) + 1);
    callRet5 = ovl_11_func_800E4B58(arg0, ((s16)callRet3));
    return callRet4 - callRet5;
}
