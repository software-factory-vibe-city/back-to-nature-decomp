#include "common.h"
s32 ovl_21_func_800BA7F0(s32 arg0);

s32 ovl_21_func_800B97F4(s32 arg0, s32 arg1, s32 arg2, s32 arg3) {
    s32 callRet3;
    s32 callRet2;
    callRet2 = ovl_21_func_800BA7F0(0);
    callRet3 = ovl_21_func_800BA7F0(1);
    if (callRet3 < callRet2) {
        return 0;
    } else {
        if (callRet2 < callRet3) {
            return 1;
        } else {
            return -1;
        }
    }
}
