#include "common.h"

/* Tentative definition for GP-relative global (target uses %gp_rel). */
s16 D_8005E324;

s32 func_80021B64(void) {
    if (D_8005E324 == 0) {
        return 0;
    }
    if (D_8005E324 == 2) {
        return 2;
    }
    return 1;
}
