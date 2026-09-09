#include "common.h"

/* Maps a value to one of eight ranges of width 0x2D starting at 0x17;
 * values outside every range fall through to 4. */
s32 ovl_23_func_800BA278(s32 arg0) {
    if ((u32)(arg0 - 0x17) < (u32)0x2D) {
        return 5;
    }
    if ((u32)(arg0 - 0x44) < (u32)0x2D) {
        return 6;
    }
    if ((u32)(arg0 - 0x71) < (u32)0x2D) {
        return 7;
    }
    if ((u32)(arg0 - 0x9E) < (u32)0x2D) {
        return 0;
    }
    if ((u32)(arg0 - 0xCB) < (u32)0x2D) {
        return 1;
    }
    if ((u32)(arg0 - 0xF8) < (u32)0x2D) {
        return 2;
    }
    if ((u32)(arg0 - 0x125) < (u32)0x2D) {
        return 3;
    }
    return 4;
}
