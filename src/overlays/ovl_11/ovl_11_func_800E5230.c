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

void ovl_11_func_800F4390(Ov11_4390struct *arg0, s32 arg1);

void ovl_11_func_800E5230(void) {
    s32 *p;
    s32 *base;
    s32 *base2;
    s32 i;

    i = 9;
    p = (s32 *)D_80129230;
    p = (s32 *)((char *)p + 0x1C4);
    while (i >= 0) {
        *p = 0;
        p = (s32 *)((char *)p - 0x30);
        i--;
    }
    base = (s32 *)&D_8006C838;
    base2 = base + (0x8000 >> 2);
    ovl_11_func_800F4390((Ov11_4390struct *)base2[0x5DD0 >> 2], *(s16 *)((char *)base2 + 0x5DFA));
    *(s16 *)((char *)base + 0x4476) = 1;
}
