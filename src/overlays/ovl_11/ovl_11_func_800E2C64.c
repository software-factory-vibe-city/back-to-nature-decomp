#include "common.h"
#include "game_types.h"

typedef struct {
    /* 0x00 */ u16 unk0;
    /* 0x02 */ char pad_02[0x16 - 0x02];
    /* 0x16 */ u16 unk16;
    /* 0x18 */ char pad_18[0x30 - 0x18];
    /* 0x30 */ s16 unk30;
    /* 0x32 */ char pad_32[0x34 - 0x32];
    /* 0x34 */ s32 unk34;
    /* 0x38 */ char pad_38[0x58 - 0x38];
    /* 0x58 */ s32 unk58;
    /* 0x5C */ s32 unk5C;
    /* 0x60 */ s32 unk60;
    /* 0x64 */ s32 unk64;
    /* 0x68 */ char pad_68[0xA8 - 0x68];
    /* 0xA8 */ char unkA8[0];
} Struct_800E2C64;

typedef struct {
    /* 0x00 */ s16 unk0;
    /* 0x02 */ s16 unk2;
} UnkStruct80107DE0;

void ovl_11_func_80107DE0(UnkStruct80107DE0 *arg0, s16 arg1, s16 arg2);
s32 func_8001FABC(s16 arg0);

s32 ovl_11_func_800E2C64(Struct_800E2C64 *arg0) {
    s32 temp;
    s32 out;
    char *far_base;
    char *base;

    if (arg0->unk0 == 0) {
        return -1;
    }
    if (arg0->unk0 != 0x109) {
        return -1;
    }
    far_base = (char *)&D_8007AFF0;
    if (*(s16 *)(far_base + 0x25476) == arg0->unk30) {
        func_8001FABC(0x18);
    }
    temp = arg0->unk16 - 10;
    base = (char *)&D_8006C838;
    arg0->unk58 = *(s32 *)(base + 0x52C8);
    arg0->unk5C = *(s32 *)(base + 0x52CC);
    arg0->unk60 = *(s32 *)(base + 0x52D0);
    arg0->unk64 = *(s32 *)(base + 0x52D4);
    arg0->unk34 = (arg0->unk34 | 0x2000) & ~0x4000;
    arg0->unk16 = temp;
    if ((s16)temp < 0) {
        out = 0;
    } else {
        out = temp;
    }
    arg0->unk16 = out;
    ovl_11_func_80107DE0((UnkStruct80107DE0 *)((s32)arg0 + 0xA8), 0x24, 0x2D);
    return 0;
}
