#include "common.h"
void func_80022738(void);

s32 func_8002261C(s32 arg0, s32 arg1);

s32 ovl_11_func_8010876C(void);

s32 ovl_11_func_80108738(void) {
    s32 callRet2;
    s32 callRet4;
    callRet2 = ovl_11_func_8010876C();
    func_80022738();
    callRet4 = func_8002261C(3, callRet2);
    return callRet4;
}
