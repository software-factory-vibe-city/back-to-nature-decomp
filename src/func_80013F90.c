#include "common.h"

typedef struct {
    /* 0x00 */ s32 field_0x00;
    /* 0x04 */ s32 field_0x04;
    /* 0x08 */ s32 field_0x08;
    /* 0x0C */ s32 field_0x0C;
    /* 0x10 */ s32 field_0x10;
    /* 0x14 */ s32 field_0x14;
    /* 0x18 */ char pad_18[0x08];
    /* 0x20 */ s32 field_0x20;
    /* 0x24 */ s32 field_0x24;
    /* 0x28 */ s32 field_0x28;
    /* 0x2C */ char pad_2C[0x08];
    /* 0x34 */ s16 field_0x34;
} Struct80013F90;

void func_80013F90(Struct80013F90 *arg0) {
    arg0->field_0x04 = 0;
    arg0->field_0x08 = 0;
    arg0->field_0x34 = -1;
    arg0->field_0x0C = 0;
    arg0->field_0x10 = 0;
    arg0->field_0x14 = 0;
    arg0->field_0x28 = 0;
    arg0->field_0x20 = 0;
    arg0->field_0x00 = 0;
    arg0->field_0x24 = 0;
}
