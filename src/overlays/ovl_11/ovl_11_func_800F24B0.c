#include "common.h"
extern s32 D_80126C90;

s32 ovl_11_func_800F2724(void);

s32 func_8002261C(s32 arg0, s32 arg1);

s32 ovl_11_func_800F24B0(s32 arg0, s32 arg1, s32 arg2, s32 arg3) {
    s32 callRet2;
    if (D_80126C90 == 0) {
        callRet2 = ovl_11_func_800F2724();
        if (callRet2 == 1) {
            D_80126C90 = callRet2;
            return 1;
        } else {
            func_8002261C(2, 0x221);
            return 0;
        }
    } else {
        return 0;
    }
}
