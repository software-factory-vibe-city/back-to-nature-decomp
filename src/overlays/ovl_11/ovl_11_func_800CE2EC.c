#include "common.h"

extern s16 D_801232BC[3][2];

s32 ovl_11_func_800CE2EC(s32 *arg0) {
    char *far_base = (char *)&D_8007AFF0;
    s32 *p = *(s32 **)(far_base + 0x25388);
    s32 idx;
    s32 x;
    s32 y;

    switch (p[1]) {
    case 0x50:
    case 0x51:
    case 0x52:
    case 0x53:
    default:
        idx = 0;
        break;
    case 0x54:
    case 0x55:
    case 0x56:
    case 0x57:
        idx = 1;
        break;
    case 0x58:
    case 0x59:
    case 0x5A:
    case 0x5B:
        idx = 2;
        break;
    }
    x = D_801232BC[idx][0];
    arg0[1] = 0;
    arg0[0] = x;
    y = D_801232BC[idx][1];
    arg0[2] = y;
    return y;
}
