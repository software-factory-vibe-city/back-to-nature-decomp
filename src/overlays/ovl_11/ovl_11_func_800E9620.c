#include "common.h"

s32 ovl_11_func_800E9620(s16 arg0, s16 arg1, s32 arg2, s32 arg3) {
    s32 i;
    struct_80076220 *temp_v1;
    u16 temp_a0;

    if (arg0 == 0x2A) {
        for (i = 1; i < 0x25; i++) {
            ovl_11_func_800E9620((s16) i, arg1, arg2, arg3);
        }
        return 1;
    }
    if ((arg0 > 0) && (arg1 < 0x25)) {
        temp_v1 = &D_80076220 + arg0;
        if (arg1 != 2) {
            temp_v1->unk1E &= 0xE7FF;
        }
        if (arg1 != 0) {
            temp_a0 = temp_v1->unk1E;
            if (temp_a0 & 0x100) {
                temp_v1->unk1E = temp_a0 & 0xFEFF;
            }
        }
    } else {
        return 0;
    }
    return 1;
}
