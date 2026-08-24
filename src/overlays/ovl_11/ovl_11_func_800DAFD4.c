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

void ovl_11_func_800DAFD4(void) {
    D_80128DE8.unk0 = -0x32C8;
    D_80128DE8.unk4 = 0x1194;
    D_80128DE8.unk8 = -0x1F40;
    D_80128DE8.unk2 = 0;
    D_80128DE8.unkA = 0x1B8;
    D_80128DE8.unkC = 0x9C4;
}
