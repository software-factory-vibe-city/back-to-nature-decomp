#include "common.h"
#include "game_types.h"

typedef struct {
    /* 0x00 */ char pad_00[0x16];
    /* 0x16 */ u16 unk16;
    /* 0x18 */ char pad_18[0x30 - 0x18];
    /* 0x30 */ s16 unk30;
    /* 0x32 */ char pad_32[0x34 - 0x32];
    /* 0x34 */ u32 unk34;
    /* 0x38 */ char pad_38[0xA8 - 0x38];
    /* 0xA8 */ char unkA8[0];
} Struct_8010DD38;

typedef struct {
    /* 0x00 */ s16 unk0;
    /* 0x02 */ s16 unk2;
} UnkStruct80107DE0;

void ovl_11_func_80107DE0(UnkStruct80107DE0 *arg0, s16 arg1, s16 arg2);

s32 ovl_11_func_8010DD38(Struct_8010DD38 *arg0) {
    s32 temp;
    s32 lower;
    s32 upper;

    temp = arg0->unk16 - 3;
    arg0->unk16 = temp;
    arg0->unk34 &= ~0x800;
    if ((s16)temp < 0) {
        lower = 0;
    } else {
        lower = temp;
    }
    arg0->unk16 = lower;
    upper = lower;
    if ((s16)upper >= 0x100) {
        upper = 0xFF;
    }
    arg0->unk16 = upper;
    ovl_11_func_80107DE0((UnkStruct80107DE0 *)((s32)arg0 + 0xA8), 0x24, 0x1E);
    if (arg0->unk30 == 0x28) {
        return -1;
    }
    return 0;
}
