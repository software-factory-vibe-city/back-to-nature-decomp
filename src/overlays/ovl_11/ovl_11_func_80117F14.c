#include "common.h"

extern s16 D_8012D7A8[];

s32 ovl_11_func_80117F14(s32 arg0) {
    if (arg0 < 0) {
        arg0 = 0;
    }
    if (arg0 >= 5) {
        arg0 = 4;
    }
    func_80022738();
    return func_8002261C(2, D_8012D7A8[arg0]);
}
