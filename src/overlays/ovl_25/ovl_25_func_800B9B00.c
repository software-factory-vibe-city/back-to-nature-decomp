#include "common.h"

s32 ovl_25_func_800B9B00(s16 *arg0, s16 arg1, s16 arg2) {
    s32 prev = arg0[1];
    if (prev != arg1) {
        arg0[2] = arg2;
    }
    arg0[1] = arg1;
    return prev;
}
