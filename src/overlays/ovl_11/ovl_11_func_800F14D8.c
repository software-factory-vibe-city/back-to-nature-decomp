#include "common.h"

s32 ovl_11_func_800F14D8(s32 arg0, s32 arg1, s32 arg2) {
    s32 i;
    s32 x;
    s32 target;
    s32 found;

    arg0 &= 0xFFFF;
    arg1 &= 0xFFFF;
    if ((arg0 == 31) || (arg1 == 31)) {
        return 1;
    }
    found = 0;
    target = *(s16 *)(arg2 + 4);
    if ((u32)arg1 >= 30U) {
        arg1 = 29;
    }
    i = 0;
    arg1++;
    for (; i < arg1; i++) {
        x = arg0 + i;
        if (x >= 31) {
            x -= 29;
        }
        if (x == target) {
            found = 1;
            break;
        }
    }
    return found;
}
