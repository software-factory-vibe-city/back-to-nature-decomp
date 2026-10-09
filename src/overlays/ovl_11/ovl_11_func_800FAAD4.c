#include "common.h"
#include "game_types.h"

void ovl_11_func_800FAAAC(void);

void func_8001FABC(s16 arg0);

s32 ovl_11_func_800FAAD4(void) {
    if (D_80126FE0 == 0) {
        ovl_11_func_800FAAAC();
        D_80126FE0 = 1;
        func_8001FABC(3);
    } else {
        return D_80126FE0;
    }
}
