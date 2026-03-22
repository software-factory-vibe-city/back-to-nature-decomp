#include "common.h"

extern u8 D_8005E025[];

s32 func_8001A8D0(s32 arg0) {
    u8 ch = arg0;
    u8 flags = D_8005E025[ch];

    if (flags & 4) {
        return ch + 0x10;
    }
    if (flags & 3) {
        return (u16)(ch - 0x41);
    }

    switch (ch - 0xA) {
        case 23:
            return 99;
        case 53:
            return 98;
        case 35:
            return 105;
        case 30:
            return 106;
        case 31:
            return 107;
        case 0:
            return 0xFFFE;
        default:
            return 4093;
    }
}
