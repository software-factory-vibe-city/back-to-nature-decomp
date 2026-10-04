#include "common.h"
#include "psyq/libapi.h"

s32 ovl_11_func_800E39B8(s32 *arg0, u32 arg1) {
    s32 sum;
    u32 count;
    u32 n;

    if (((u32)arg0 & 3) != 0) {
        SystemError(0x43, 0x190);
    }
    if ((arg1 & 3) != 0) {
        SystemError(0x43, 0x191);
    }
    n = arg1 >> 2;
    sum = 0;
    for (count = 0; count < n; count++) {
        sum += *arg0;
        arg0++;
    }
    return sum;
}
