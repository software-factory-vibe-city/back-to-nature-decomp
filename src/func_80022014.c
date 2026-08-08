#include "common.h"

s32 func_80022014(s32 arg0, s16 arg1) {
    u32 i;
    u32 j;

    i = 0;
    arg0 += 2;
    for (i = 0; i < 3; i++) {
        for (j = 0; j < 6; j++) {
            if (*(s16 *)((char *)arg0 + i * 84 + j * 14) == arg1) {
                return 1;
            }
        }
    }
    return 0;
}
