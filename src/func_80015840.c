#include "common.h"

typedef struct {
    char pad[2];
    u16 field_2;
    s8 field_4;
    s8 field_5;
    s16 field_6;
} Struct_80015840;

void func_80015840(Struct_80015840 *arg0, s8 arg1) {
    u16 temp = arg0->field_2;
    arg0->field_4 = arg1;
    arg0->field_5 = 0;
    arg0->field_6 = 0;
    arg0->field_2 = temp & 0xFCFF;
}
