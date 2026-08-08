#include "common.h"

s32 D_8005E520;

s32 func_8001E7DC(s32 *arg0, s32 *arg1) {
    s32 bound;
    s32 lower;
    s32 delta;

    delta = *arg0++ - *arg1++;
    bound = (D_8005E520 >> 1) + 0x258;
    lower = -bound;
    if (delta < lower) {
        goto fail;
    }
    if (!(bound < delta)) {
        goto check_y;
    }
fail:
    return 0;
check_y:
    delta = *arg0++ - *arg1++;
    if (delta < lower) {
        goto fail;
    }
    if (bound < delta) {
        goto fail;
    }
    delta = *arg0 - *arg1;
    if (delta < lower) {
        goto fail;
    }
    if (bound < delta) {
        goto fail;
    }
    return 1;
}
