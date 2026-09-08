#include "common.h"

typedef struct {
    /* 0x00 */ char pad_00[0x04];
    /* 0x04 */ u16 field_04;
} D8006C838Inner4A58;

typedef struct {
    /* 0x00 */ char pad_00[0x0C];
    /* 0x0C */ s32 field_0C;
    /* 0x10 */ char pad_10[0xDDD4 - 0x10];
    /* 0xDDD4 */ D8006C838Inner4A58 *field_DDD4;
} D8006C838View4A58;

extern s32 D_80129634;

void ovl_11_func_800F4A58(void) {
    D8006C838View4A58 *base = (D8006C838View4A58 *)&D_8006C838;
    D8006C838Inner4A58 *entry;
    u16 flags;

    entry = base->field_DDD4;
    flags = entry->field_04;
    if ((flags & 0x100) && !(base->field_0C & 0x08000000)) {
        if (D_80129634 == 0) {
            entry->field_04 = (u16)(flags & 0xFEFF);
            return;
        }
        D_80129634 -= 1;
    }
}
