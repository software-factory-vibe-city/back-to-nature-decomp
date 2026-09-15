#include "common.h"

s32 ovl_11_func_800F3C9C(u16 arg0) {
    if (arg0 < 0x41) {
        return -1;
    }
    if (arg0 < 0x50) {
        return (s16)(arg0 - 0x41);
    }
    if ((u32)(arg0 - 0x5D) < 0xC8) {
        switch (arg0) {
            case 232:
            case 290:
            case 291:
            case 292:
                return 0xF;
            case 139:
            case 140:
            case 141:
            case 227:
                return 0x10;
            case 145:
            case 146:
            case 147:
            case 231:
                return 0x11;
            case 136:
            case 137:
            case 138:
            case 229:
                return 0x12;
            case 142:
            case 143:
            case 144:
            case 228:
                return 0x13;
            case 148:
            case 149:
            case 150:
            case 230:
                return 0x14;
            case 161:
            case 162:
            case 163:
                return 0x15;
            case 93:
            case 94:
            case 95:
                return (s16)(arg0 + 0xFFB9);
        }
    }
    return -1;
}
