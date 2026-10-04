#include "common.h"
#include "game_types.h"

typedef struct {
    /* 0x00 */ char pad_00[0x16];
    /* 0x16 */ u16 unk16;
    /* 0x18 */ char pad_18[0xA8 - 0x18];
    /* 0xA8 */ char unkA8[0];
} Struct_800E1158;

typedef struct {
    /* 0x00 */ s16 unk0;
    /* 0x02 */ s16 unk2;
} UnkStruct80107DE0;

void ovl_11_func_80107DE0(UnkStruct80107DE0 *arg0, s16 arg1, s16 arg2);

s32 ovl_11_func_800E1158(Struct_800E1158 *arg0) {
    s32 temp;
    s32 out;

    if (ovl_11_func_800E109C((UnkStruct800E109C *)arg0) == 0) {
        return -1;
    }
    temp = arg0->unk16 - 1;
    arg0->unk16 = temp;
    if ((s16)temp < 0) {
        out = 0;
    } else {
        out = temp;
    }
    arg0->unk16 = out;
    ovl_11_func_80107DE0((UnkStruct80107DE0 *)((s32)arg0 + 0xA8), 0x1F, 0x2D);
    return 0;
}
