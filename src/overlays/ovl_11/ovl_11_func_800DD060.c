#include "common.h"
#include "game_types.h"

typedef struct {
    /* 0x00 */ u16 vx;
    /* 0x02 */ u16 vy;
    /* 0x04 */ u16 vz;
    /* 0x06 */ u16 pad;
} Ovl11FuncDD060Vec;

typedef struct {
    /* 0x00 */ u8 pad0[0x20];
    /* 0x20 */ Ovl11FuncDD060Vec *unk20;
    /* 0x24 */ Ovl11FuncDD060Vec *unk24;
    /* 0x28 */ Ovl11FuncDD060Vec *unk28;
    /* 0x2C */ u8 pad2C[0x2];
    /* 0x2E */ s16 unk2E;
    /* 0x30 */ s16 unk30;
} Ovl11FuncDD060Arg;

void ovl_11_func_800DD060(s32 arg0, Ovl11FuncDD060Arg *arg1) {
    s32 i;
    s16 ratio;
    s16 denom;
    Ovl11FuncDD060Vec d;

    ratio = arg1->unk2E;
    denom = arg1->unk30;
    for (i = 0; i < arg0; i++) {
        d.vx = arg1->unk24[i].vx - arg1->unk20[i].vx;
        d.vy = arg1->unk24[i].vy - arg1->unk20[i].vy;
        d.vz = arg1->unk24[i].vz - arg1->unk20[i].vz;
        arg1->unk28[i].vx = (s16)d.vx * ratio / denom + arg1->unk20[i].vx;
        arg1->unk28[i].vy = (s16)d.vy * ratio / denom + arg1->unk20[i].vy;
        arg1->unk28[i].vz = (s16)d.vz * ratio / denom + arg1->unk20[i].vz;
    }
}
