#include "common.h"

s32 ovl_11_func_8011184C(s16 arg0) {
    s32 temp_v1;

    temp_v1 = (s32)((arg0 << 0x10) + 0xFFBF0000) >> 0x10;
    switch (temp_v1) {
    case 0x0:
        return 4;
    case 0x1:
        return 5;
    case 0x2:
        return 6;
    case 0x3:
        return 7;
    case 0x4:
        return 8;
    case 0x5:
        return 9;
    case 0x6:
        return 0xA;
    case 0x7:
        return 0xB;
    case 0x8:
        return 0xC;
    case 0x9:
        return 0xD;
    case 0xA:
        return 0xE;
    case 0xB:
        return 0xF;
    case 0xC:
        return 0x10;
    case 0xD:
        return 0x11;
    case 0xE:
        return 0x12;
    case 0x10:
        return 0x14;
    case 0x11:
        return 0x15;
    case 0x12:
        return 0x16;
    case 0x13:
        return 0x1B;
    case 0x14:
        return 0x17;
    case 0x15:
        return 0x18;
    case 0xE1:
    case 0xE2:
    case 0xE3:
        return 0x1D;
    case 0xA7:
        return 0x1E;
    default:
        return -1;
    }
}
