#include "common.h"

void ovl_28_func_800B8A20(void) {
    Ovl28B9630Record *base;
    Ovl28B9630Record *iter;
    s32 i;

    base = D_800B9630;
    for (i = 0; i < 20; i++) {
        iter = base + i;
        if (iter->unk0 == 1) {
            func_80015EE8(D_8005E3C0->field_D8 + 8, (s32)D_800B9720, 0,
                          (u8)iter->unk4, 0, (s16)(iter->unk8 / 4096));
        }
    }
}
