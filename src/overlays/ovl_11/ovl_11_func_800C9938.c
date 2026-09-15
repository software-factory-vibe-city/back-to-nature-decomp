#include "common.h"

typedef struct {
    char pad_0[0x38];
    u16 unk38;
    char pad_3A[0x2];
    u16 unk3C;
    char pad_3E[0x2E];
    s32 unk6C;
    char pad_70[0xA0];
    s32 unk110;
    char pad_114[0x4];
    s32 unk118;
} Ovl119938View;

typedef struct {
    s16 a;
    s16 b;
} Ovl119938Pair;

extern Ovl119938Pair D_801230B0[];
extern Ovl119938Pair D_801230D0[];
extern Ovl119938Pair D_801230F0[];

s32 ovl_11_func_800C9938(Ovl119938View *arg0) {
    Ovl119938Pair *tbl;

    tbl = D_801230B0;
    if (arg0->unk3C == 2) {
        tbl += 4;
    }
    if (arg0->unk3C == 4) {
        tbl = D_801230D0;
    }
    if (arg0->unk6C & 0x100) {
        if (arg0->unk3C == 2) {
            tbl = D_801230D0;
        } else {
            tbl = D_801230F0;
        }
    }
    tbl += arg0->unk38;
    arg0->unk110 += tbl->a;
    arg0->unk118 += tbl->b;
    return arg0->unk118;
}
