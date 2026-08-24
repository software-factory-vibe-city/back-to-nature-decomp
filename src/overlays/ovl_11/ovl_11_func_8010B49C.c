#include "common.h"

typedef struct {
    /* 0x00 */ u16 field_0;
    /* 0x02 */ char pad_02[0x34 - 0x02];
    /* 0x34 */ s32 field_34;
} Ov11FlagSet;

s32 ovl_11_func_8010B49C(Ov11FlagSet *arg0) {
    s32 temp_v1;

    if (arg0->field_0 == 0) {
        return -1;
    }
    temp_v1 = arg0->field_34;
    if (temp_v1 & 0x8000) {
        arg0->field_34 = temp_v1 | 0x800000;
    }
    return 0;
}
