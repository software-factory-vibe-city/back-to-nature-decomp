#include "common.h"

s32 ovl_11_func_800D622C(s8 arg0, s8 arg1, s16 arg2) {
    char *base = (char *)&D_80071A00;
    s32 temp_a0;
    s32 var_a0;
    s16 limit;
    s32 value;
    s32 temp_v1b;
    s32 var_a1b;
    s32 var_v1;
    s32 var_v0_2;
    s32 var_a0_2;
    char *p;

    if (arg0 != 0) {
        temp_a0 = *(u16 *)(base + 0x12) + arg0;
        *(u16 *)(base + 0x12) = temp_a0;
        if ((s16)temp_a0 < 0) {
            var_a0 = 0;
        } else {
            var_a0 = temp_a0;
        }
        *(u16 *)(base + 0x12) = var_a0;
        limit = *(s16 *)(base + 0x14);
        if ((s16)var_a0 < limit) {
            value = var_a0;
        } else {
            value = limit;
        }
        *(u16 *)(base + 0x12) = value;
    }
    if ((arg1 < 0) || ((arg1 > 0) && !(*(u16 *)(base + 0x36) & 8))) {
        temp_v1b = *(u16 *)(base + 0x16) + arg1;
        *(u16 *)(base + 0x16) = temp_v1b;
        if ((s16)temp_v1b < 0) {
            var_v1 = 0;
        } else {
            var_v1 = temp_v1b;
        }
        *(u16 *)(base + 0x16) = var_v1;
        var_a1b = var_v1;
        if ((s16)var_a1b >= 0x65) {
            var_a1b = 0x64;
        }
        *(u16 *)(base + 0x16) = var_a1b;
        if ((*(s32 *)((char *)&D_80071A00 - 0xD08) == 6) && ((s16)var_a1b >= 0x64)) {
            *(u16 *)(base + 0x16) = 0x63;
        }
    }
    if (arg2 != 0) {
        p = (char *)&D_80071A00 - 0x51C8;
        *(s32 *)(p + 0x5220) = *(s32 *)(p + 0x5220) + arg2;
        var_v0_2 = *(s32 *)(base + 0x58);
        if (var_v0_2 < 0) {
            var_v0_2 = 0;
        }
        *(s32 *)(p + 0x5220) = var_v0_2;
        var_a0_2 = *(s32 *)(base + 0x58);
        if (var_a0_2 > 0xFFFF) {
            var_a0_2 = 0xFFFF;
        }
        *(s32 *)(p + 0x5220) = var_a0_2;
    }
    return 1;
}
