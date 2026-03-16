#include "common.h"
#include "globals_override.h"

#undef D_80061DE8
extern struct struct_80061DE8 D_80061DE8;

void func_8001BA40(s32 arg0, s32 arg1, s32 arg2) {
    D_80061DE8.field_0C = arg0;
    D_80061DE8.field_10 = arg1;
    D_80061DE8.field_14 = arg2;
    D_80061DE8.field_1C = 0;
}
