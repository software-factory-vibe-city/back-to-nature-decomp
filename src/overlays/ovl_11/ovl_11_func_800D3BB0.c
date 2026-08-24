#include "common.h"

s32 ovl_11_func_800D3BB0(u16 *arg0) {
    u16 temp_v0;

    temp_v0 = *arg0;
    switch (temp_v0) {
    case 0x15B:
        return 0x18;
    case 0x108:
    case 0x10B:
    case 0x10C:
    case 0x10D:
    case 0x10E:
    case 0x10F:
    case 0x110:
    case 0x112:
    case 0x113:
    case 0x114:
    case 0x115:
    case 0x116:
    case 0x117:
    case 0x118:
    case 0x119:
    case 0x11A:
    case 0x153:
    case 0x155:
    case 0x159:
    case 0x17A:
    case 0x17B:
        return 0xC;
    case 0x162:
    case 0x165:
        return 6;
    default:
        return 0xC;
    }
}
