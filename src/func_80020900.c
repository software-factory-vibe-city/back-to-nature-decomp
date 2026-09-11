#include "common.h"
s32 SsUtSetReverbType(s32 arg0);

void SsUtSetReverbDepth(s32 arg0, s32 arg1);

s32 func_80020900(s16 arg0) {
    s32 callRet2;
    callRet2 = SsUtSetReverbType(arg0);
    SsUtSetReverbDepth(0, 0);
    return callRet2;
}
