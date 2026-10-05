#include "common.h"

s32 ovl_15_func_80135B68(void) {
    u8 t1;
    u8 c;
    s32 i;
    s32 j;
    s32 ret;
    u8 *q;

    t1 = 0;
    for (i = 5; i < 0x100; i++) {
        c = 0;
        for (j = 0; j < 0x7F; j++) {
            c ^= D_80137830[i * 0x80 + j];
        }
        t1 ^= c;
        if (D_80137830[i * 0x80 + j] != c) {
            return -1;
        }
    }
    if (D_80137A30[0x38] != t1) {
        return -1;
    }
    c = 0;
    q = D_80137A30;
    for (i = 0; i < 0x7F; i++) {
        c ^= *q++;
    }
    ret = -1;
    if (D_80137830[0x27F] == c) {
        ret = 0;
    }
    return ret;
}
