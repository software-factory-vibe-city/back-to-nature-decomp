#include "common.h"
#include "globals_override.h"

#undef D_80061DE8
extern struct struct_80061DE8 D_80061DE8;

void func_8001B9F8(s32 arg0, s32 arg1, s32 arg2, s32 arg3) {
    D_80061DE8.field_00 = arg0;
    D_80061DE8.field_04 = arg1;
    D_80061DE8.field_08 = arg2;
    D_80061DE8.field_18 = arg3;
    D_80061DE8.field_1C = 0;
}
