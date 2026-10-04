#include "common.h"

void ovl_28_func_800B86D8(void);

void ovl_28_func_800B865C(void) {
    char *base;
    char *hi;
    u16 v;

    D_800B9618 = ovl_28_func_800B86D8;
    D_800B93C4 = -1;
    D_800B93C6 = 0;
    D_800B93C8 = 0;
    D_800B93CA = 0;
    D_800B93C0 = 0;
    base = (char *)&D_8006C838;
    hi = base + 0x8000;
    D_800B93CE = 0;
    v = *(u16 *)(hi + 0x67A0);
    if (v >= 10) {
        D_800B93CC = 10;
    } else {
        D_800B93CC = v;
    }
}
