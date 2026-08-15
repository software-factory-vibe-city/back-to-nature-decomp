#include "common.h"

s32 func_80013FC0(s32 arg0) {
    s32 type;

    if (D_8005E9C8[arg0][0] != 0) {
        return 0xFF00FFFF;
    }

    type = D_8005E9C8[arg0][1] >> 4;
    if (type != 4 && type != 7) {
        return 0xFF00FFFF;
    }

    return (func_8001413C(arg0) << 8) | D_8005E9C8[arg0][3];
}
