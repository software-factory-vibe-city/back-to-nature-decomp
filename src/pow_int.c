#include "common.h"

s32 func_8001F250(s32 arg0, s32 arg1) {
    s32 result;

    result = 1;
    if (arg1 > 0) {
        do {
            arg1 -= 1;
            result *= arg0;
        } while (arg1 != 0);
    }
    return result;
}
