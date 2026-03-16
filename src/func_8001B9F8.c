#include "common.h"
#include "globals_override.h"

#undef D_80061DE8
extern struct struct_80061DE8 D_80061DE8;

void func_8001B9F8(s32 arg0, s32 arg1, s32 arg2, s32 arg3) {
    D_80061DE8.unk0 = arg0;
    D_80061DE8.unk4 = arg1;
    D_80061DE8.unk8 = arg2;
    D_80061DE8.unk18 = arg3;
    D_80061DE8.field_1C = 0;
}
