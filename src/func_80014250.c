#include "common.h"

s32 func_800142D8(s32, s32);

s32 func_80014250(s32 arg0) {
    if ((D_8005E9C8[arg0][1] >> 4) != 4) {
        if ((D_8005E9C8[arg0][1] >> 4) == 7) {
            if ((D_8005E9C8[arg0][2] & 0xF0) == 0xF0) {
                return func_800142D8(D_8005E9C8[arg0][6], D_8005E9C8[arg0][7]);
            }
        }
        return -1;
    }
    return -1;
}
