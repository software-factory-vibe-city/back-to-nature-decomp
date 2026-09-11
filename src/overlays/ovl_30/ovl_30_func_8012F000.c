#include "common.h"
extern s32 D_80134B0C;

s32 ovl_30_func_8012F000(void) {
    s32 result;
    result = D_80134B0C;
    if (D_80134B0C == 0) {
        D_80134B0C = 0;
    }
    return result;
}
