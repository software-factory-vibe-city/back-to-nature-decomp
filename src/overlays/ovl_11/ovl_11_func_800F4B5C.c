#include "common.h"

typedef struct {
    /* 0x00 */ char pad_00[0x44D6];
    /* 0x44D6 */ u16 field_44D6;
    /* 0x44D8 */ char pad_44D8[0x44F8 - 0x44D8];
    /* 0x44F8 */ s32 field_44F8;
} D8006C838View4B5C;

s32 ovl_11_func_800F4B5C(s16 arg0) {
    D8006C838View4B5C *base = (D8006C838View4B5C *)&D_8006C838;

    if (!(base->field_44F8 & 2)) {
        return 0;
    }
    if (base->field_44D6 != 0) {
        return 0;
    }
    if (arg0 < 0x56) {
        if (arg0 >= 0x51) {
            base->field_44D6 = (u16) arg0;
            return 1;
        }
    }
    return 0;
}
