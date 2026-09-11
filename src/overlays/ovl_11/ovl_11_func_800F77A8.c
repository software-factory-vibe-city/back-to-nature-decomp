#include "common.h"
extern s16 D_80126E2C;

s32 ovl_11_func_800F77F0(s32 arg0);

s32 ovl_11_func_800F77A8(s16 arg0, s32 arg1, s32 arg2, s32 arg3) {
    s32 callRet1;
    if (arg0 == -1) {
        D_80126E2C = 0;
        return 0;
    } else {
        callRet1 = ovl_11_func_800F77F0(1);
        return ((s16)callRet1);
    }
}
