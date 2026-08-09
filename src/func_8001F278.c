#include "common.h"

void func_8001F278(s32 arg0, s32 arg1, s32 *arg2, s32 *arg3, s32 *arg4) {
    s32 i;
    s32 *out;

    if (arg1 < arg0) {
        arg0 = arg1;
    }
    arg0 = arg1 - arg0;

    out = arg4;
    i = 2;
    do {
        *out++ = (*arg2 - *arg3) * arg0 / arg1 + *arg3;
        i--;
        arg2++;
        arg3++;
    } while (i >= 0);
}
