#include "common.h"

typedef struct {
    /* 0x00 */ s16 unk0;
    /* 0x02 */ s16 unk2;
    /* 0x04 */ u16 unk4;
    /* 0x06 */ s16 pad6;
    /* 0x08 */ s32 unk8;
    /* 0x0C */ s32 unkC;
    /* 0x10 */ s32 unk10;
} Ov11_4360struct;

/* 4-byte, alignment-1 block. A BLK-mode parameter is left memory-resident by
 * assign_parms, which reproduces the target's entry home stores and the
 * per-use reloads for the by-value arguments. */
typedef struct {
    u8 b[4];
} Ov11_F43CCArgBlk;

void ovl_11_func_800F4360(Ov11_4360struct *arg0, u16 arg1, u16 arg2, s32 x, s32 y, s32 z, s32 w);

void ovl_11_func_800F43CC(s32 arg0, Ov11_F43CCArgBlk arg1, Ov11_F43CCArgBlk arg2, Ov11_F43CCArgBlk arg3, Ov11_F43CCArgBlk arg4, u16 arg5, s32 arg6) {
    Ov11_4360struct *var_a3;
    char *p;
    char *p_1;
    char *p_2;
    u16 temp_a1;

    temp_a1 = arg0 & 0xFFFF;
    switch (temp_a1) {
    case 0xE8:
    case 0x122:
    case 0x123:
    case 0x124:
        p = (char *)&D_8006C838;
        var_a3 = (Ov11_4360struct *)(*(s32 *)(p + 0x8000 + 0x5DCC) + (arg6 * 0x18));
        break;
    case 0x65:
        p_1 = (char *)&D_8006C838;
        var_a3 = (Ov11_4360struct *)((u8 *)(*(Ov11_4360struct **)(p_1 + 0x8000 + 0x5DD4)) + 0x18);
        break;
    case 0x64:
        p_2 = (char *)&D_8006C838;
        var_a3 = *(Ov11_4360struct **)(p_2 + 0x8000 + 0x5DD4);
        break;
    default:
        return;
    }
    ovl_11_func_800F4360(var_a3, temp_a1, arg5, *(s32 *)&arg1, *(s32 *)&arg2, *(s32 *)&arg3, *(s32 *)&arg4);
}
