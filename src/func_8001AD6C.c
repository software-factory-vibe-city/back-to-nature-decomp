#include "common.h"

s16 D_8005E460;

s32 func_8001AD6C(s32 arg0) {
    s16 temp_s0;
    s32 temp_v0;
    s32 masked;

    masked = arg0 & 0xFFFF;
    temp_s0 = func_80017C30();
    temp_v0 = GetPairedTpage(masked);
    if (temp_s0 != temp_v0) {
        func_8001A018(temp_v0, 1);
    }
    if (D_8005E460 == temp_v0) {
        func_80019FC4(temp_v0);
        return 1;
    }
    return 0;
}
