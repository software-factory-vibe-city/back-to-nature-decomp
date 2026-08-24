#include "common.h"

typedef struct {
    s32 field_0;
    s32 field_4;
    s32 field_8;
} Struct_800D03B4;

void ovl_11_func_800D03B4(Struct_800D03B4 *arg0, Struct_800D03B4 *arg1, s32 arg2) {
    arg0->field_0 = arg0->field_0 + arg1->field_0;
    arg0->field_4 = arg0->field_4 + arg1->field_4;
    arg0->field_8 = arg0->field_8 + arg1->field_8;
    if (arg2 == 0) {
        arg1->field_0 = 0;
        arg1->field_4 = 0;
        arg1->field_8 = 0;
    }
}
