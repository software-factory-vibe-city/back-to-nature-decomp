#include "common.h"

typedef struct {
    s16 unk0;
    s16 unk2;
    s32 unk4;
} Rec;

extern Rec D_80140F90[2][5];
extern s16 D_8013759E;
extern u16 D_801375A4;

void ovl_15_func_80134000(s32 arg0, s16 arg1) {
    s32 idx;
    s32 i;
    s16 v;

    v = D_8013759E;
    i = 0;
    idx = (arg0 != (s32)&D_800742EC);
    for (; i < 5; i++) {
        if (D_80140F90[idx][i].unk0 == v && D_80140F90[idx][i].unk2 == arg1) {
            break;
        }
    }
    if (i < 5) {
        D_80140F90[idx][i].unk0 = -1;
        D_80140F90[idx][i].unk2 = -1;
        D_80140F90[idx][i].unk4 = 0;
        D_801375A4 -= 1;
    }
}
