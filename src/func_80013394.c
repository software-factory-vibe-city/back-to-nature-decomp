#include "common.h"

s16 D_8005E294;
s16 D_8005E3CC;
s16 D_8005E3CE;

s32 func_80013394(void) {
    if (D_8005E294 == 1) {
        return D_8005E3CC < 1;
    }
    if (D_8005E294 == 3) {
        return D_8005E3CC == (D_8005E3CE + 3);
    }
    if (D_8005E294 == 2) {
        return D_8005E3CC >= (D_8005E3CE + 1);
    }
    return 1;
}
