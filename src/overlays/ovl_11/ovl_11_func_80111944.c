#include "common.h"

s32 ovl_11_func_80111944(s16 arg0) {
    switch (arg0) {
    case 0x68:
        return 0;
    case 0x6B:
        return 1;
    case 0x8B:
        return 8;
    case 0x8C:
        return 9;
    case 0x8D:
        return 0xA;
    case 0xE3:
        return 0xB;
    case 0x91:
        return 0xC;
    case 0x92:
        return 0xD;
    case 0x93:
        return 0xE;
    case 0xE7:
        return 0xF;
    case 0xE8:
        return 6;
    case 0x122:
    case 0x123:
    case 0x124:
        return 5;
    default:
        return -1;
    }
}
