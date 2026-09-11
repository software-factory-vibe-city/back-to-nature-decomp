#include "common.h"
s32 SsVoKeyOff(s32 arg0, s32 arg1);

s32 func_80020768(s32 arg0, s32 arg1, s32 arg2) {
    SsVoKeyOff(arg1 + (arg0 << 8), arg2);
    return 0;
}
