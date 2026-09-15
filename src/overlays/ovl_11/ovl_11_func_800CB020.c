#include "common.h"

s16 ovl_11_func_800CB020(s16 arg0) {
    s32 temp_v0;
    s32 temp_v1;
    s32 temp_a;
    s16 temp_s;

    temp_v1 = arg0 - 0x1A;
    if ((u32) ((arg0 - 1) & 0xFFFF) < 0x19U) {
        temp_v0 = (arg0 - 1) / 5;
        temp_s = (temp_v0 * 0x14) + 0x48;
        temp_a = (temp_v0 * 5) + 1;
        return (s16) (temp_s + (arg0 - temp_a));
    }
    if ((u32) (temp_v1 & 0xFFFF) < 4U) {
        return (s16) ((temp_v1 * 4) + 0xB6);
    }
    return 0;
}
