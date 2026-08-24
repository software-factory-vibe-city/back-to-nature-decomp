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

void ovl_11_func_800CBF40(UnkStruct800CBF40 *arg0) {
    arg0->unk0 = 0;
    arg0->unk6 = 0;
    arg0->unk4 = 0;
    arg0->unk2 = 0;
    arg0->unk14 = 0;
    arg0->unk18 = 0;
    arg0->unk1C = 0;
    arg0->unkC = 0;
    arg0->unk24 = 0;
    arg0->unk28 = 0;
    arg0->unk2C = 0;
}
