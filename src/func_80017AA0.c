#include "common.h"

s16 D_8005E44C;

/*
 * Returns an integer encoding of the current mode stored in D_8005E44C (set by
 * func_80017A70 / func_80017A48):
 *   0 -> mode is 0  (inactive / off)
 *   2 -> mode is 5  (some specific active state)
 *   1 -> any other non-zero value
 * Callers can use this to distinguish "off", "full", and "partial" states.
 */
s32 func_80017AA0(void) {
    s16 mode;

    mode = D_8005E44C;
    if (mode == 0) {
        return 0;
    }
    if (mode == 5) {
        return 2;
    }
    return 1;
}
