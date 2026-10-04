#include "common.h"

s32 ovl_11_func_800D2E20(void);

s32 ovl_11_func_800CF258(s32 arg0) {
    Ovl11ItemEntry *entry;
    s16 mask;
    s32 i;

    mask = ovl_11_func_800D2E20();
    entry = D_80123758;
    for (i = 0; i < 0x11; i++) {
        if (entry->unk0 == arg0) {
            return (mask & entry->unk4) != 0;
        }
        entry++;
    }
    return 0;
}
