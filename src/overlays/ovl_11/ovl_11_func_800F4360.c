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
} Ov11_4360struct;

void ovl_11_func_800F4360(Ov11_4360struct *arg0, s16 arg1, s16 arg2, Vec3 vec) {
    arg0->unk0 = arg2;
    arg0->unk2 = arg1;
    arg0->unk8 = vec.x;
    arg0->unkC = vec.y;
    arg0->unk10 = vec.z;
    arg0->unk4 = (u16)(arg0->unk4 | 1);
}
