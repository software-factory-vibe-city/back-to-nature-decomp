#include "common.h"

extern s32 D_80128A88;

void ovl_11_func_800C0EA4(s32 arg0) {
    s32 i;

    i = 0;
    if (D_80128A88 == -1) {
        D_80128A88 = arg0;
        return;
    }
loop:
    i++;
    if (i >= 0x32) {
        goto exit;
    }
    if (*(&D_80128A88 + i) == -1) {
        *(&D_80128A88 + i) = arg0;
        goto exit;
    }
    goto loop;
exit:
    return;
}
