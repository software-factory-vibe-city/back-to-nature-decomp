#include "common.h"

typedef struct {
    /* 0x00 */ char pad_00[0x34];
    /* 0x34 */ s32 field_34;
    /* 0x38 */ char pad_38[0x58 - 0x38];
    /* 0x58 */ s32 field_58;
    /* 0x5C */ s32 field_5C;
    /* 0x60 */ s32 field_60;
} Ov11SetFields;

typedef struct {
    s32 field_0;
    s32 field_4;
    s32 field_8;
} Ov11SetVec;

void ovl_11_func_800D05D0(Ov11SetFields *arg0, Ov11SetVec v) {
    arg0->field_58 = v.field_0;
    arg0->field_5C = v.field_4;
    arg0->field_60 = v.field_8;
    arg0->field_34 = (arg0->field_34 | 0x2000) & ~0x4000;
}
