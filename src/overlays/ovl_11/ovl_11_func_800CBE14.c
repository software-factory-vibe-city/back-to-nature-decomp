#include "common.h"

void ovl_11_func_800CBE14(s32 arg0) {
    u16 *p = (u16 *)D_8006C838;
    u16 tmp = p[0x2900];
    p[0x2900] = arg0;
    p[0x2901] = tmp;
}
