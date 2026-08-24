#include "common.h"

typedef struct {
    /* 0x00 */ s16 unk0;
    /* 0x02 */ s16 unk2;
    /* 0x04 */ s16 unk4;
    /* 0x06 */ s16 unk6;
    /* 0x08 */ s32 unk8;
    /* 0x0C */ s16 unkC;
    /* 0x0E */ s16 unkE;
    /* 0x10 */ s16 unk10;
    /* 0x12 */ s16 unk12;
    /* 0x14 */ s32 unk14;
} UnkStruct80106DC0;

void ovl_11_func_80106DC0(UnkStruct80106DC0 *arg0) {
    arg0->unkC = 0;
    arg0->unkE = 0;
    arg0->unk10 = 0;
    arg0->unk8 = 0;
    arg0->unk4 = 0;
    arg0->unk2 = 4;
    arg0->unk0 = 0;
    arg0->unk14 = 0;
}
