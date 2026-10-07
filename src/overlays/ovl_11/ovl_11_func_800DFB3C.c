#include "common.h"
#include "game_types.h"
#include "psyq/stddef.h"
#include "psyq/libgte.h"

typedef struct {
    /* 0x00 */ char pad_00[0x26];
    /* 0x26 */ s16 unk26;
    /* 0x28 */ s16 unk28;
    /* 0x2A */ s16 unk2A;
    /* 0x2C */ s16 unk2C;
    /* 0x2E */ char pad_2E[0x34 - 0x2E];
    /* 0x34 */ s32 unk34;
    /* 0x38 */ char pad_38[0x58 - 0x38];
    /* 0x58 */ s32 unk58;
    /* 0x5C */ s32 unk5C;
    /* 0x60 */ s32 unk60;
    /* 0x64 */ s32 unk64;
} Struct_800DFB3C;

s32 ovl_11_func_800DF010(Struct_800DFB3C *arg0, s32 arg1);

s32 ovl_11_func_800DFB3C(Struct_800DFB3C *arg0) {
    char *base;

    base = (char *)&D_8006C838;
    arg0->unk58 = *(s32 *)(base + 0x52C8);
    arg0->unk5C = *(s32 *)(base + 0x52CC);
    arg0->unk60 = *(s32 *)(base + 0x52D0);
    arg0->unk64 = *(s32 *)(base + 0x52D4);
    arg0->unk34 |= 0x2000;
    ovl_11_func_800DF010(arg0, 0x12);
    return 0;
}
