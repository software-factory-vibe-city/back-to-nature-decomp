#include "common.h"

void ovl_28_func_800B895C(void) {
    Ovl28B9630Record *iter;
    s32 v;
    s32 i;

    iter = D_800B9630;
    v = VWD0 << 12;
    for (i = 0; i < 20; i++) {
        iter->unk0 = 0;
        iter->unk4 = 0;
        iter->unk8 = v;
        iter += 1;
    }
}
