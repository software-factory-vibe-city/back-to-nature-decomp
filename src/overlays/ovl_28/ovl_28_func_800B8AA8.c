#include "common.h"

void ovl_28_func_800B8AA8(void) {
    Ovl28B9630Record *iter;
    s32 v;
    s32 one;
    s32 limit;
    s32 i;

    one = 1;
    v = D_800B93B4;
    limit = -0xE000;
    iter = D_800B9630;
    for (i = 0; i < 20; i++) {
        if (iter->unk0 == one) {
            iter->unk8 -= v;
            if (iter->unk8 <= limit) {
                iter->unk0 = 0;
            }
        }
        iter += 1;
    }
}
