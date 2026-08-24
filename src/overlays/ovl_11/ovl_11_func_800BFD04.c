#include "common.h"

void ovl_11_func_800BFD04(s16 arg0) {
    char *base;

    /* Two-stage base formation keeps the +0x8000 materialized at runtime
     * (lui/addiu/ori/addu) instead of folding it into the store offset;
     * same idiom as matched siblings func_8001A284 / func_80021E60. */
    base = (char *)&D_8006C838;
    base += 0x8000;
    *(s16 *)(base + 0x64C8) = arg0;
}
