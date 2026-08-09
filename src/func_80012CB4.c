#include "common.h"

s32 func_80012CB4(s32 arg0, s32 *arg1, s32 arg2) {
    s32 temp_v0;

    temp_v0 = VSync(-1);
    if (*arg1 == 0) {
        *arg1 = temp_v0;
    }
    if (temp_v0 - *arg1 < arg0) {
        return 0;
    }
    if (arg2 == 1) {
        *arg1 = temp_v0;
    }
    return 1;
}
