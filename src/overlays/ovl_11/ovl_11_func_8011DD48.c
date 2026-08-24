#include "common.h"

extern s32 D_8005181A;

typedef struct {
    /* 0x00 */ s32 field_0;
    /* 0x04 */ s32 field_4;
    /* 0x08 */ s16 field_8;
    /* 0x0A */ s16 field_A;
} ovl_11_DD48_arg0;

void ovl_11_func_8011DD48(ovl_11_DD48_arg0 *arg0, s32 arg1, s16 arg2, s16 arg3, s16 arg4) {
    arg0->field_0 = arg1;
    arg0->field_A = arg3;
    if (arg4) {
        arg0->field_8 = arg4;
    }
    if (arg2 == 0) {
        arg0->field_4 = D_80054BC0[0] + (s32)&D_8005181A;
    }
}
