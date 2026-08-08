#include "common.h"

s32 D_8005E520;

/* Proximity test on a 2D pair: returns 1 when both component deltas fall
 * strictly inside +/-bound, where bound = (D_8005E520 >> 1) + 600. Any
 * component reaching the bound returns 0. func_8001E7DC is the 3-component
 * form of the same test over the same tolerance global.
 *
 * The subtractions assign back into the parameters. That is load-bearing:
 * a separate delta variable is a fresh pseudo whose allocno inherits the
 * argument registers as hard-register preferences, so it lands on $a3 and
 * forces a second argument copy. Reusing the parameter keeps the delta on
 * the incoming web, which is what produces the entry `move v1,a1` and the
 * in-place `subu v1,v1,a3`. */
s32 func_8001E78C(s32 arg0, s32 arg1, s32 arg2, s32 arg3) {
    s32 bound;
    s32 lower;

    bound = (D_8005E520 >> 1) + 0x258;
    lower = -bound;

    arg0 = arg0 - arg2;
    if (arg0 <= lower || arg0 >= bound) {
        return 0;
    }

    arg1 = arg1 - arg3;
    if (arg1 <= lower || arg1 >= bound) {
        return 0;
    }

    return 1;
}
