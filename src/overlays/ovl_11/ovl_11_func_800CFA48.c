#include "common.h"

s32 ovl_11_func_800D3230(u16 arg0);
s32 func_80012A34(s32 arg0);

void ovl_11_func_800CFA48(void) {
    char *base;

    if ((ovl_11_func_800D3230(0) >= 0) || (ovl_11_func_800D3230(1) >= 0)) {
        base = (char *)D_8006C838;
        if ((*(s16 *)(base + 0xE4C8) == 0) && (*(s16 *)(base + 0x44BA) != 3) && (func_80012A34(0xA) == 0)) {
            *(s32 *)(base + 0x44F8) |= 0x800000;
        }
    }
}
