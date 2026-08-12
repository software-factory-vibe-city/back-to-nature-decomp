#include "common.h"
#include "psyq/stddef.h"
#include "psyq/libcd.h"

/* GP-relative globals owned by this TU (CD loading state). */
s32 D_8005E2B0;
s32 D_8005E3F8;
s32 D_8005E3FC;
s32 D_8005E400;
s32 D_8005E40C;

s32 func_80014B44(void) {
    s32 temp_v0;

    if (D_8005E2B0 != 0) {
        temp_v0 = CdReadSync(1, 0);
        if (temp_v0 == -1) goto minus1;
        if (temp_v0 != 0) goto nonzero;
        D_8005E2B0 = 0;
        D_8005E40C = 1;
        return 1;
minus1:
        D_8005E2B0 = 0;
        func_80014854(D_8005E3F8, D_8005E3FC, D_8005E400);
        D_8005E40C = 0;
        return 0;
nonzero:
        D_8005E40C = 0;
        return 0;
    }
    return -1;
}
