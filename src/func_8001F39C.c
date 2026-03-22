#include "common.h"

typedef struct {
    s32 field_0;
    s32 field_4;
    s32 field_8;
} Struct_8001F39C;

void func_8001F39C(Struct_8001F39C *arg0, Struct_8001F39C *arg1) {
    arg0->field_0 = arg0->field_0 - arg1->field_0;
    arg0->field_4 = arg0->field_4 - arg1->field_4;
    arg0->field_8 = arg0->field_8 - arg1->field_8;
}
