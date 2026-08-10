#include "common.h"
#include "psyq/libspu.h"
#include "psyq/libsnd.h"

/* Tentative definitions — this TU owns these GP-relative globals. */
s32 D_8005E53C;
s32 D_8005E55C;

s32 func_80020818(void) {
    s32 *var_s0;
    s32 *var_s2;
    s32 *var_s3;
    s32 temp_a0;
    s32 var_s1;
    s32 var_s4;

    var_s4 = -1;
    var_s3 = &D_8006C068;
    var_s0 = &D_8006BFC8;
    var_s2 = &D_8006C028;
    var_s1 = 5;
    do {
        temp_a0 = *var_s2;
        if ((temp_a0 != var_s4) && (*var_s0 == var_s4)) {
            *var_s0 = SsSeqOpen((unsigned long *)temp_a0, (short)*var_s3);
        }
        var_s3++;
        var_s0++;
        var_s1 -= 1;
        var_s2++;
    } while (var_s1 >= 0);
    if (D_8005E53C == 0) {
        SsStart();
    }
    D_8005E53C = 1;
    if (D_8005E55C != 0) {
        SsSetStereo();
    } else {
        SsSetMono();
    }
    return 0;
}
