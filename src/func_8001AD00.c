#include "common.h"
s32 GetPairedTpage(s32 arg0);

void func_80019E80(s32 arg0, s32 arg1, s32 arg2, s32 arg3);

void func_8001AD00(s32 arg0, u16 arg1, s16 arg2, s16 arg3) {
    s32 callRet4;
    callRet4 = GetPairedTpage(arg1);
    func_80019E80(arg0, ((s16)(arg2 + -4)), ((s16)(arg3 + -0x54)), callRet4);
}
