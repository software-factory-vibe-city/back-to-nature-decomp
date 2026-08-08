#include "common.h"

/* TU-owned globals (GP-relative — tentative definitions). */
s16 D_8005E47A;
u16 D_8005E444;
u16 *D_8005E4A8;
u16 D_8005E2BA;

s16 func_80019030(void) {
    s16 result;
    s32 tmp;

    result = D_8005E47A;

    if (D_8005E4A8[D_8005E444 - 1] == 0xFFFE) {
        tmp = result - 12;
        result = (s16)(tmp - D_8005E2BA);
    }

    return result;
}
