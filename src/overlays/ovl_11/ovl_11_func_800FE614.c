#include "common.h"

void ovl_11_func_800FE614(u16 *arg0, s32 arg1) {
    s32 offset = *D_80054BBC + arg1;
    arg0[0] = *(u16 *)((unsigned char *)&D_8005175C + offset);
    arg0[1] = 0xFFFF;
}
