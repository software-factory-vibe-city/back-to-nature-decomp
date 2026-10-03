#include "common.h"
#include "game_types.h"

void ovl_21_func_800B9798(s16 arg0, s16 arg1) {
    s32 i;

    for (i = arg0 * 3; i < arg0 * 3 + 3; i++) {
        ((UnkStruct800C0448 *)D_800C0448)[i].unk18 = arg1;
    }
}
