#include "common.h"

s32 ovl_11_func_800C9888(u16 arg0, u16 arg1) {
    switch (arg0) {
    case 0x4000:
    case 0xC000:
        arg1 = 0;
        break;
    case 0x8000:
    case 0x9000:
        arg1 = 1;
        break;
    case 0x1000:
    case 0x3000:
        arg1 = 2;
        break;
    case 0x2000:
    case 0x6000:
        arg1 = 3;
        break;
    }
    return arg1;
}
