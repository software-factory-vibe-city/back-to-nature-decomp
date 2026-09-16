#include "common.h"

typedef struct {
    /* 0x00 */ char pad_00[0x51DA];
    /* 0x51DA */ s16 field_51DA;
    /* 0x51DC */ s16 field_51DC;
    /* 0x51DE */ s16 field_51DE;
} D8006C838View164F8;

extern u16 D_80128214[5][4];

u16 ovl_11_func_801164F8(void) {
    D8006C838View164F8 *base = (D8006C838View164F8 *)&D_8006C838;
    s16 ratio;
    s16 level;
    s32 row;
    s32 col;

    ratio = base->field_51DA;
    ratio = (ratio * 100) / base->field_51DC;
    level = base->field_51DE;

    row = 0;
    if (ratio < 0x46) {
        if (ratio >= 0x32) {
            row = 1;
        } else if (ratio >= 0x14) {
            row = 2;
        } else if (ratio >= 5) {
            row = 3;
        } else {
            row = 4;
        }
    }

    col = 0;
    if (level >= 0x32) {
        if (level >= 0x46) {
            col = 3;
            if (level < 0x5A) {
                col = 2;
            }
        } else {
            col = 1;
        }
    }

    return D_80128214[row][col];
}
