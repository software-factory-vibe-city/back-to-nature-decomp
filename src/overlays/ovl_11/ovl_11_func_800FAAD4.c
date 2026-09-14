#include "common.h"
#include "game_types.h"

void ovl_11_func_800FAAAC(void);

void func_8001FABC(s16 arg0);

s32 ovl_11_func_800FAAD4(s32 arg0, s32 arg1, s32 arg2, s32 arg3) {
    if (D_80126FE0 == 0) {
        ovl_11_func_800FAAAC();
        D_80126FE0 = 1;
        func_8001FABC(3);
    } else {
        return D_80126FE0;
    }
}
