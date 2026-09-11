#include "common.h"
typedef struct {
    s16 unk0;
} ReconA0View;

s32 ovl_11_func_800D5868(s32 arg0);

s32 ovl_11_func_801108F8(ReconA0View *arg0, s32 arg1, s32 arg2, s32 arg3) {
    s32 callRet2;
    callRet2 = ovl_11_func_800D5868(arg0->unk0);
    if (callRet2 == 0) {
        return 0;
    } else {
        return ((u32)0) < ((u32)(arg0->unk0 ^ 0x36));
    }
}
