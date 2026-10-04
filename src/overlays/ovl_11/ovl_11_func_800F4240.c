#include "common.h"

extern s16 D_80070CF2;

typedef struct {
    char pad0[2];
    s16 unk2;
    u16 unk4;
} ReconA0View;

s32 ovl_11_func_800F581C(void);

s32 ovl_11_func_800F4240(ReconA0View *arg0) {
    s16 temp_a1;
    u16 temp_v0;

    temp_v0 = (ovl_11_func_800F581C() | 1) & 0xFFFF;
    if (temp_v0 != (arg0->unk4 & temp_v0)) {
        return 0;
    }
    temp_a1 = arg0->unk2;
    if (D_80070CF2 != 2) {
        return temp_a1;
    }
    if (temp_a1 == 0x40) {
        temp_a1 = 0x13A;
    }
    return temp_a1;
}
