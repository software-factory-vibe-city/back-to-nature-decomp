#include "common.h"
s32 ovl_11_func_800D0C34(void);

s32 ovl_11_func_800D0D7C(s32 arg0);

void ovl_11_func_800DF128(s32 arg0, s32 arg1);

void ovl_11_func_800D075C(s32 arg0, s32 arg1, s32 arg2);

s32 ovl_11_func_800DE8A4(s32 arg0, s32 arg1, s32 arg2) {
    s32 callRet3;
    s32 callRet4;
    if (((u32)(arg0 + -0x160)) < ((u32)3)) {
        callRet3 = ovl_11_func_800D0C34();
        if (callRet3 == 0) {
            return 0;
        } else {
            callRet4 = ovl_11_func_800D0D7C(callRet3);
            ovl_11_func_800DF128(callRet3, arg0);
            ovl_11_func_800D075C(callRet3, ((s16)callRet4), 1);
            return callRet3;
        }
    } else {
        return 0;
    }
}
