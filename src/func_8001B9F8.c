#include "common.h"

#undef D_80061DE8

struct UnkStruct_D_80061DE8 {
    s32 unk0;
    s32 unk4;
    s32 unk8;
    char pad_0xC[0xC];
    s32 unk18;
    s32 unk1C;
};

extern struct UnkStruct_D_80061DE8 D_80061DE8;

void func_8001B9F8(s32 arg0, s32 arg1, s32 arg2, s32 arg3) {
    D_80061DE8.unk0 = arg0;
    D_80061DE8.unk4 = arg1;
    D_80061DE8.unk8 = arg2;
    D_80061DE8.unk18 = arg3;
    D_80061DE8.unk1C = 0;
}
