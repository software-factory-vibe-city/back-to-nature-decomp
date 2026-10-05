#include "common.h"
#include "game_types.h"

typedef struct {
    /* 0x00 */ char pad_00[0x16];
    /* 0x16 */ u16 unk16;
    /* 0x18 */ char pad_18[0x30 - 0x18];
    /* 0x30 */ s16 unk30;
    /* 0x32 */ char pad_32[0xAE - 0x32];
    /* 0xAE */ u16 unkAE;
} Struct_800DF614;

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

s32 ovl_11_func_800DF4F0(UnkStruct800DF4F0 *arg0);
void func_80015868(Struct_800154CC *arg0, s16 arg1, s16 arg2, s16 arg3, s16 arg4);
void ovl_11_func_800D049C(Struct_800D049C *arg0);
void ovl_11_func_800D12A0(s16 arg0);

s32 ovl_11_func_800DF614(Struct_800DF614 *arg0) {
    char *far_base;

    if (ovl_11_func_800DF4F0((UnkStruct800DF4F0 *)arg0) == 0) {
        return -1;
    }
    if (arg0->unkAE == 0) {
        return -1;
    }
    arg0->unkAE = 0;
    func_80015868((Struct_800154CC *)((s32)arg0 + 0x78), 0, 0, 0, 0);
    ovl_11_func_800D049C((Struct_800D049C *)arg0);
    far_base = (char *)&D_8007AFF0;
    if (*(s16 *)(far_base + 0x25476) == arg0->unk30) {
        ovl_11_func_800D12A0(9);
    }
    return 0;
}
