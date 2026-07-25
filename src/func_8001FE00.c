#include "common.h"

void func_8001FE00(s32 arg0) {
    struct_80061F08 *base;
    s32 field_10;
    s32 one;

    base = &D_80061F08;
    field_10 = base->field_10;
    field_10 = field_10 / arg0;
    base->field_0C = field_10;
    one = 1;
    base->field_04 = one;
}
