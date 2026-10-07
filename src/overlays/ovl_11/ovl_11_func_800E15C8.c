#include "common.h"
#include "game_types.h"

typedef struct {
    /* 0x00 */ char pad_00[0x30];
    /* 0x30 */ s16 unk30;
    /* 0x32 */ char pad_32[0x2];
    /* 0x34 */ s32 unk34;
} Struct_800E15C8;

typedef struct {
    /* 0x00 */ s16 unk0;
    /* 0x02 */ s16 unk2;
} UnkStruct80107DE0;

typedef struct {
    /* 0x00 */ char pad_00[0x16];
    /* 0x16 */ s16 unk16;
    /* 0x18 */ char pad_18[0xA8 - 0x18];
    /* 0xA8 */ UnkStruct80107DE0 unkA8;
} Struct_800D049C;

s32 ovl_11_func_800E109C(UnkStruct800E109C *arg0);
void ovl_11_func_800D049C(Struct_800D049C *arg0);
void ovl_11_func_800D0DCC(UnkStruct800DF4F0 *arg0);
void ovl_11_func_800D12A0(s16 arg0);

s32 ovl_11_func_800E15C8(Struct_800E15C8 *arg0) {
    char *far_base;

    if (ovl_11_func_800E109C((UnkStruct800E109C *)arg0) == 0) {
        return -1;
    }
    if (!(arg0->unk34 & 2)) {
        ovl_11_func_800D049C((Struct_800D049C *)arg0);
    }
    arg0->unk34 |= 2;
    ovl_11_func_800D0DCC((UnkStruct800DF4F0 *)arg0);
    far_base = (char *)&D_8007AFF0;
    if (*(s16 *)(far_base + 0x25476) == arg0->unk30) {
        ovl_11_func_800D12A0(0xB);
    }
    return 0;
}
