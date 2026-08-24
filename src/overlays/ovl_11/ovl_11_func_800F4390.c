#include "common.h"
#include "game_types.h"

typedef struct {
    /* 0x00 */ s16 unk0;
    /* 0x02 */ s16 unk2;
    /* 0x04 */ u16 unk4;
    /* 0x06 */ s16 pad6;
    /* 0x08 */ s32 unk8;
    /* 0x0C */ s32 unkC;
    /* 0x10 */ s32 unk10;
    /* 0x14 */ s32 unk14;
} Ov11_4390struct;

void ovl_11_func_800F4390(Ov11_4390struct *arg0, s32 arg1) {
    s32 i;

    for (i = 0; i < arg1; i++) {
        arg0->unk0 = 0;
        arg0->unk2 = 0;
        arg0->unk8 = 0;
        arg0->unkC = 0;
        arg0->unk10 = 0;
        arg0->unk4 = (u16)(arg0->unk4 & 0xFFFE);
        arg0++;
    }
}
