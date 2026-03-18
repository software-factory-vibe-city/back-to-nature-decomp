#include "common.h"

typedef struct {
    s32 field_0;
    s32 field_4;
    s32 field_8;
} Struct_8001F39C;

void func_8001F39C(Struct_8001F39C *arg0, Struct_8001F39C *arg1) {
    s32 v0;
    s32 v1;
    v0 = arg0->field_0;
    v1 = arg1->field_0;
    v0 = v0 - v1;
    v1 = arg0->field_4;
    arg0->field_0 = v0;
    v0 = arg1->field_4;
    v1 = v1 - v0;
    v0 = arg0->field_8;
    arg0->field_4 = v1;
    v1 = arg1->field_8;
    v0 = v0 - v1;
    arg0->field_8 = v0;
}
