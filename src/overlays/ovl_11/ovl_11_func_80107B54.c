#include "common.h"

extern s16 D_80070CF8;

s32 ovl_11_func_80107B54(s32 arg0, s32 arg1) {
    if (arg0 <= D_80070CF8 && D_80070CF8 < arg1) {
        return 0;
    }
    return 1;
}
