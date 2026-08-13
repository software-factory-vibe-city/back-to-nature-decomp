#include "common.h"
#include "psyq/libsnd.h"

/* Game callee (signature from include/functions.h). */
s32 func_80020414(s32 arg0, s32 arg1);

/* Tentative definitions for GP-relative globals owned by this TU. */
s32 D_8005E53C;

s32 func_80020A94(void) {
    s32 i;
    s32 j;
    s32 *ptr;
    s32 sentinel;

    SsSetMVol(0, 0);

    for (i = 0; i < 6; i++) {
        j = 0;
        do {
            func_80020414(i, j);
            j++;
        } while (j <= 0);
    }

    sentinel = -1;
    ptr = &D_8006BFC8;
    for (i = 0; i < 6; i++) {
        if (*ptr != sentinel) {
            SsSeqClose((s16) *ptr);
            *ptr = sentinel;
        }
        ptr++;
    }

    SsEnd();
    D_8005E53C = 0;

    ptr = &D_8006BFA8;
    for (i = 0; i < 6; i++) {
        if (*ptr >= 0) {
            SsVabClose((s16) *ptr);
            *ptr = -1;
        }
        ptr++;
    }

    return 0;
}
