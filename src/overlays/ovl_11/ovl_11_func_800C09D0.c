#include "common.h"

extern s32 D_80128A88;
extern s32 D_80128B50;
extern s32 D_80128B54;
extern s32 D_80128B58;

void ovl_11_func_800C09D0(void) {
    s32 *base = (s32 *)D_8006C838;

    base[0x35] = 0;
    memset(&D_80128A88, -1, 0xC8);
    *(s16 *)((char *)D_8006C838 + 0xD0) = 0;
    D_80128B54 = 0;
    D_80128B50 = 0;
    D_80128B58 = 0;
}
