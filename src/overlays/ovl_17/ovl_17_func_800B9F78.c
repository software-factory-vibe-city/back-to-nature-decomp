#include "common.h"
s32 func_80012A34(s32 arg0);

s32 ovl_17_func_800B9F78(s16 arg0) {
    s32 callRet2;
    callRet2 = func_80012A34(0x7F);
    return arg0 < callRet2;
}
