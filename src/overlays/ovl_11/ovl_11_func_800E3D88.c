#include "common.h"
typedef struct {
    char pad_0[0x2];
    s16 unk2;
} ReconPointee0View;

extern ReconPointee0View *D_8006C868;

s32 func_8001AF44(s32 arg0);

s32 ovl_11_func_800E3D88(s32 arg0, s32 arg1, s32 arg2, s32 arg3) {
    s32 callRet1;
    callRet1 = func_8001AF44(2);
    if (callRet1 == 0) {
        return 0;
    } else {
        return D_8006C868->unk2;
    }
}
