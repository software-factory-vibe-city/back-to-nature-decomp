#include "common.h"

typedef struct {
    /* 0x00 */ s16 unk0;
    /* 0x02 */ s16 unk2;
    /* 0x04 */ s16 unk4;
    /* 0x06 */ s16 unk6;
    /* 0x08 */ s16 unk8;
    /* 0x0A */ s16 unkA;
    /* 0x0C */ u16 unkC;
} UnkStruct800BFF50;

void ovl_11_func_800BFF50(UnkStruct800BFF50 *arg0) {
    arg0->unk0 = 0;
    arg0->unk2 = 0;
    arg0->unk4 = 0;
    arg0->unk6 = 0;
    arg0->unkA = 0;
    arg0->unk8 = 0;
    arg0->unkC = 0x8000;
}
