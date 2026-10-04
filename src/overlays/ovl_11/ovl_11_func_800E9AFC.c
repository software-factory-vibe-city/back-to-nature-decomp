#include "common.h"

s32 ovl_11_func_800E9AFC(s16 arg0, s16 arg1, s32 arg2) {
    s32 result;

    result = 1;
    if (arg2 != 0) {
        if (arg0 != 0) {
            func_8001FE00((s32) arg1);
        } else {
            func_8001FE34((s32) arg1);
        }
    } else {
        result = func_8001FE6C() == 0;
    }
    return result;
}
