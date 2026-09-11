#include "common.h"
typedef struct {
    char pad_0[0x10];
    s16 unk10;
    char pad_12[0x2];
    s16 unk14;
} ReconA0View;

typedef struct {
    char pad_0[0x10];
    s16 unk10;
    char pad_12[0x2];
    s16 unk14;
} ReconA1View;

void SquareRoot0(s32 arg0);

void ovl_19_func_800BA564(ReconA0View *arg0, ReconA1View *arg1) {
    SquareRoot0((arg0->unk10 - arg1->unk10) * (arg0->unk10 - arg1->unk10) + (arg0->unk14 - arg1->unk14) * (arg0->unk14 - arg1->unk14));
}
