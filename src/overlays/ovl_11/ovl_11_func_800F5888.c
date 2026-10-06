#include "common.h"

extern s32 D_80129620[2];
extern s16 D_80129628[4];

s32 func_8001DFD4(s32 *arg0, s16 *arg1);
s32 ovl_11_func_800F5868(s32 arg0, s32 arg1);

s32 ovl_11_func_800F5888(u16 *arg0, s32 *arg1, s32 arg2) {
    s32 ret;

    D_80129620[1] = 0x5DC;
    D_80129620[0] = 0x5DC;
    D_80129628[0] = arg0[0];
    D_80129628[1] = arg0[1];
    D_80129628[2] = arg0[2];
    ret = func_8001DFD4(D_80129620, D_80129628);
    if (ret > 0) {
        if (ovl_11_func_800F5868(D_80129620[0], D_80129620[1]) != 0) {
            arg1[0] = D_80129620[0];
            arg1[1] = D_80129620[1];
            arg1[2] = ret;
            return 1;
        }
    }
    return 0;
}
