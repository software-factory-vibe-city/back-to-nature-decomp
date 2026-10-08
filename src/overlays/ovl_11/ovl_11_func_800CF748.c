#include "common.h"

s32 func_80012A34(s32 arg0);
u16 *ovl_11_func_800CE744(s32 arg0, s32 arg1);
extern s32 D_80123920[];

void ovl_11_func_800CF748(void) {
    char *far_base;
    char *s0;
    s32 buf[4];

    far_base = (char *)&D_8007AFF0;
    switch (*(s16 *)(far_base + 0x25476)) {
    case 0x1F:
        buf[0] = D_80123920[0];
        buf[1] = D_80123920[1];
        buf[2] = D_80123920[2];
        buf[3] = D_80123920[3];
        break;
    case 0x1B:
        buf[0] = D_80123920[4];
        buf[1] = D_80123920[5];
        buf[2] = D_80123920[6];
        buf[3] = D_80123920[7];
        break;
    case 0x1C:
    case 0x1E:
    default:
        return;
    }
    s0 = (char *)ovl_11_func_800CE744(0x108, -1);
    if (s0 == 0) {
        return;
    }
    *(s32 *)(s0 + 0x38) = buf[0];
    *(s32 *)(s0 + 0x3C) = buf[1];
    *(s32 *)(s0 + 0x40) = buf[2];
    if (func_80012A34(2) != 0) {
        *(u16 *)(s0 + 0x22) = 0;
    } else {
        *(u16 *)(s0 + 0x22) = 3;
    }
}
