#include "common.h"

/* GP-relative globals owned by this TU. */
u8 D_8005E2E0;
u8 D_8005E2E1;
u8 D_8005E2E2;

void func_8001BF88(s32 arg0, s32 arg1, s32 arg2) {
    D_8005E2E0 = arg0;
    D_8005E2E1 = arg1;
    D_8005E2E2 = arg2;
}
