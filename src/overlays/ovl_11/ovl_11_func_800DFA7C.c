#include "common.h"
#include "game_types.h"

typedef struct {
    /* 0x00 */ char pad_00[0x16];
    /* 0x16 */ s16 unk16;
    /* 0x18 */ char pad_18[0x30 - 0x18];
    /* 0x30 */ s16 unk30;
    /* 0x32 */ char pad_32[0x34 - 0x32];
    /* 0x34 */ s32 unk34;
    /* 0x38 */ char pad_38[0x58 - 0x38];
    /* 0x58 */ s32 unk58;
    /* 0x5C */ s32 unk5C;
    /* 0x60 */ s32 unk60;
    /* 0x64 */ s32 unk64;
} Struct_800DFA7C;

s32 func_80012A34(s32 arg0);
s32 ovl_11_func_800DF010(Struct_800DFA7C *arg0, s32 arg1);

s32 ovl_11_func_800DFA7C(Struct_800DFA7C *arg0) {
    char *far_base;
    char *base;
    s32 ret;

    ret = 0;
    far_base = (char *)&D_8007AFF0;
    if (*(s16 *)(far_base + 0x25476) != arg0->unk30) {
        return -1;
    }
    if (func_80012A34(0xC8) < arg0->unk16) {
        base = (char *)&D_8006C838;
        arg0->unk58 = *(s32 *)(base + 0x52C8);
        arg0->unk5C = *(s32 *)(base + 0x52CC);
        arg0->unk60 = *(s32 *)(base + 0x52D0);
        arg0->unk64 = *(s32 *)(base + 0x52D4);
        arg0->unk34 |= 0x2000;
        ovl_11_func_800DF010(arg0, 0x12);
    } else {
        ret = -1;
    }
    return ret;
}
