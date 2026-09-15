#include "common.h"

typedef struct {
    /* 0x00 */ s16 unk0;
    /* 0x02 */ s16 unk2;
    /* 0x04 */ s16 unk4;
    /* 0x06 */ s16 pad6;
    /* 0x08 */ s16 unk8;
    /* 0x0A */ s16 unkA;
    /* 0x0C */ s16 unkC;
} Ovl11DE8;

extern Ovl11DE8 D_80128DE8;

void ovl_11_func_800DB054(Ovl11DE8 *arg0) {
    if (arg0->unk0 < D_80128DE8.unk0) {
        arg0->unk0 = D_80128DE8.unk0;
    }
    if (arg0->unk4 > D_80128DE8.unk4) {
        arg0->unk4 = D_80128DE8.unk4;
    }
    if (arg0->unk0 > D_80128DE8.unk8) {
        arg0->unk0 = D_80128DE8.unk8;
    }
    if (arg0->unk4 < D_80128DE8.unkC) {
        arg0->unk4 = D_80128DE8.unkC;
    }
}
