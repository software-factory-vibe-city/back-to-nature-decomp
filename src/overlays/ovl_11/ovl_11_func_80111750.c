#include "common.h"
#include "game_types.h"
#include "psyq/stddef.h"
#include "psyq/libgte.h"




s32 ovl_11_func_80111750(s16 arg0) {
    switch (arg0) {
    case 0x122:
    case 0x123:
    case 0x124:
        return 0xC;
    case 0xE8:
        return 0xD;
    case 0x8B:
        return 0xE;
    case 0x8C:
        return 0xF;
    case 0x8D:
        return 0x10;
    case 0xE3:
        return 0x11;
    case 0x91:
        return 0x12;
    case 0x92:
        return 0x13;
    case 0x93:
        return 0x14;
    case 0xE7:
        return 0x15;
    }
    return -1;
}
