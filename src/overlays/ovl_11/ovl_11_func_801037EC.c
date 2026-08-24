#include "common.h"

extern s16 D_8012CF10[7];
extern s16 D_8012CF1C;
extern s32 D_8012CF24;
extern s32 D_80127428;
extern s32 D_8012742C;

void ovl_11_func_801037EC(void) {
    s32 i;

    D_80127428 = 0;
    D_8012742C = 0;
    for (i = 0; i < 6; i++) {
        D_8012CF10[i] = 0;
    }
    D_8012CF24 = 0;
    D_8012CF1C = 0;
}
