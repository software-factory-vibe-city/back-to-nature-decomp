#include "common.h"

extern s16 D_80122E74[];

s32 ovl_11_func_800BFC20(s16 *arg0) {
    struct_80076220 *entry;
    s32 i;

    for (i = 0; i < 5; i++) {
        entry = &D_80076220 + D_80122E74[i];
        if (entry->unk24 == arg0[0]) {
            if (entry->unk26 == arg0[1]) {
                return 1;
            }
        }
    }
    return 0;
}
