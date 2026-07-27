#include "common.h"

/* POLY_G4 primitive initializer (PSY-Q helper family; sibling at
 * func_800154CC (POLY_F4)).  Sets len/code, RGB for four vertices,
 * the four vertex coordinates, links the primitive into the ordering
 * table, and returns the next primitive slot.
 * See: ./notes/research/func_800153BC-polyg4-scheduling-variance.md */
typedef struct {
    /* 0x00 */ s8 field_0;
    /* 0x01 */ s8 field_1;
    /* 0x02 */ s8 field_2;
    /* 0x03 */ s8 field_3;
    /* 0x04 */ s8 field_4;
    /* 0x05 */ s8 field_5;
    /* 0x06 */ s8 field_6;
    /* 0x07 */ s8 field_7;
    /* 0x08 */ s16 field_8;
    /* 0x0A */ s16 field_A;
    /* 0x0C */ s8 field_C;
    /* 0x0D */ s8 field_D;
    /* 0x0E */ s8 field_E;
    /* 0x0F */ char pad_F;
    /* 0x10 */ s16 field_10;
    /* 0x12 */ s16 field_12;
    /* 0x14 */ s8 field_14;
    /* 0x15 */ s8 field_15;
    /* 0x16 */ s8 field_16;
    /* 0x17 */ char pad_17;
    /* 0x18 */ s16 field_18;
    /* 0x1A */ s16 field_1A;
    /* 0x1C */ s8 field_1C;
    /* 0x1D */ s8 field_1D;
    /* 0x1E */ s8 field_1E;
    /* 0x1F */ char pad_1F;
    /* 0x20 */ s16 field_20;
    /* 0x22 */ s16 field_22;
} Struct_800153BC;

void* func_800153BC(Struct_800153BC *arg0, s32 *arg1, s16 arg2, s16 arg3, s16 arg4, s16 arg5, s32 arg6, s32 arg7, s32 arg8, s32 arg9, s16 arg10) {
    s32 mask;
    s32 temp_v0;
    s32 temp_v1;
    s8 var_v0;

    arg0->field_3 = 8;
    arg0->field_7 = 0x38;
    if (arg10 != 0) {
        var_v0 = 0x3A;
        arg0->field_7 = var_v0;
    } else {
        var_v0 = 0x38;
        arg0->field_7 = var_v0;
    }
    temp_v0 = arg2 + arg4;
    arg0->field_A = arg3;
    arg0->field_12 = arg3;
    temp_v1 = arg3 + arg5;
    arg0->field_10 = (s16)temp_v0;
    arg0->field_20 = (s16)temp_v0;
    arg0->field_1A = (s16)temp_v1;
    arg0->field_22 = (s16)temp_v1;
    arg0->field_4 = (s8) (arg6 >> 0x10);
    arg0->field_5 = (s8) (arg6 >> 8);
    arg0->field_C = (s8) (arg7 >> 0x10);
    arg0->field_D = (s8) (arg7 >> 8);
    arg0->field_14 = (s8) (arg8 >> 0x10);
    arg0->field_15 = (s8) (arg8 >> 8);
    arg0->field_8 = arg2;
    arg0->field_18 = arg2;
    arg0->field_6 = (s8) arg6;
    arg0->field_E = (s8) arg7;
    arg0->field_16 = (s8) arg8;
    arg0->field_1C = (s8) (arg9 >> 0x10);
    arg0->field_1D = (s8) (arg9 >> 8);
    arg0->field_1E = (s8) arg9;
    mask = 0xFFFFFF;
    *(s32 *)arg0 = (*(s32 *)arg0 & 0xFF000000) | (*arg1 & mask);
    *arg1 = (*arg1 & 0xFF000000) | ((s32) arg0 & mask);
    return (void *)((char *)arg0 + 0x24);
}
