#include "common.h"

/* Callee prototype as the original caller TU saw it. */
void func_800245F4(s32 arg0, s16 arg1, s16 arg2);

void ovl_15_func_80134450(s16 arg0, s16 arg1, s16 arg2) {
    s32 i;
    s16 v;

    v = arg1;
    for (i = 0; i < arg0; i++) {
        func_800245F4(D_8005E3C0->field_D8 + 4, v, arg2);
        v -= 8;
    }
}
