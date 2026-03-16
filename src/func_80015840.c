#include "common.h"
#include "game_types.h"

void func_80015840(ObjectState *obj, s8 arg1) {
    u16 temp = obj->field_2;
    obj->field_4 = arg1;
    obj->field_5 = 0;
    obj->field_6 = 0;
    obj->field_2 = temp & 0xFCFF;
}
