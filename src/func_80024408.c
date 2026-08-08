#include "common.h"

s32 func_80024408(s32 arg0, s32 arg1, s32 arg2) {
    if (arg1 < 2) {
        if ((u32)(arg0 - 10) < 3) {
            if (arg2 == 0) {
                return 9;
            }
            return 13;
        }
    }
    if (arg1 == 5) {
        return 13;
    }
    return arg0;
}
