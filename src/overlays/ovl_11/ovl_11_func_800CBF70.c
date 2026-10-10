#include "common.h"

typedef struct {
    /* 0x00 */ s16 unk0;
    /* 0x02 */ s16 unk2;
    /* 0x04 */ s16 unk4;
    /* 0x06 */ s16 unk6;
    /* 0x08 */ s16 unk8;
    /* 0x0A */ char pad0A[0x0C - 0x0A];
    /* 0x0C */ s32 unkC;
    /* 0x10 */ s32 unk10;
    /* 0x14 */ s32 unk14;
    /* 0x18 */ s32 unk18;
    /* 0x1C */ s32 unk1C;
    /* 0x20 */ char pad20[0x24 - 0x20];
    /* 0x24 */ s32 unk24;
    /* 0x28 */ s32 unk28;
    /* 0x2C */ s32 unk2C;
} UnkStruct800CBF40;

typedef struct {
    /* 0x00 */ s32 unk0;
    /* 0x04 */ s32 unk4;
    /* 0x08 */ s32 unk8;
} UnkStruct800CBF70Arg0;

typedef struct {
    /* 0x00 */ s32 unk0;
    /* 0x04 */ s32 unk4;
} UnkStruct800CBF70Table;

extern u8 D_80128BB0[];
extern u8 D_80123130[];

UnkStruct800CBF40 *ovl_11_func_800CBF70(UnkStruct800CBF70Arg0 *arg0, u16 *arg1, s16 arg2) {
    UnkStruct800CBF40 *var_s0;
    UnkStruct800CBF70Table *temp_s1;
    u16 temp_a0;
    u32 var_a0;

    var_s0 = (UnkStruct800CBF40 *) D_80128BB0;
    var_a0 = 0;
    do {
        var_a0 += 1;
        if (var_s0->unk2 == 0) {
            temp_s1 = (UnkStruct800CBF70Table *) ((u8 *) D_80123130 + (arg2 * 8));
            var_s0->unk8 = arg2;
            ovl_11_func_800CBF40(var_s0);
            temp_a0 = *arg1;
            var_s0->unk2 = (s16) temp_a0;
            var_s0->unk24 = arg0->unk0;
            var_s0->unk28 = arg0->unk4 - 0x12C;
            var_s0->unk2C = arg0->unk8;
            var_s0->unk14 = temp_s1->unk0;
            var_s0->unk18 = -0x1E;
            var_s0->unk1C = temp_s1->unk4;
            if ((s16) temp_a0 == 0x65) {
                var_s0->unk18 = -0xC;
                var_s0->unkC = -0x1C;
                var_s0->unk14 = temp_s1->unk0 * 2;
                var_s0->unk1C = temp_s1->unk4 * 2;
            }
            if (var_s0->unk2 == 0x186) {
                var_s0->unkC = -0x4E;
                var_s0->unk18 = -0x1E;
                var_s0->unk14 = (temp_s1->unk0 * 2) / 3;
                var_s0->unk1C = (temp_s1->unk4 * 2) / 3;
            }
            var_s0->unk10 = ((struct struct_8006C838_800CBF70 *) D_8006C838)->field_52CC;
            return var_s0;
        }
        var_s0 = (UnkStruct800CBF40 *) ((u8 *) var_s0 + 0x34);
    } while (var_a0 < 3U);
    return 0;
}
