#include "common.h"

void ovl_15_func_80135AE0(void) {
    u8 sum;
    u8 c;
    s32 i;
    s32 j;
    u8 *q;

    sum = 0;
    for (i = 5; i < 256; i++) {
        c = 0;
        for (j = 0; j < 127; j++) {
            c ^= D_80137830[i * 0x80 + j];
        }
        D_80137830[i * 0x80 + j] = c;
        sum ^= c;
    }
    D_80137A30[0x38] = sum;
    c = 0;
    q = D_80137A30;
    for (i = 0; i < 127; i++) {
        c ^= *q++;
    }
    D_80137830[0x27F] = c;
}
