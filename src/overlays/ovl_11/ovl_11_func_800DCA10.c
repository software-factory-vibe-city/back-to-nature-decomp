#include "common.h"

typedef struct {
    char pad0[0x8];
    s16 unk8;
    s16 unkA;
    s16 unkC;
    char padE[0x2];
    s16 unk10;
    s16 unk12;
    s16 unk14;
    char pad16[0xA];
    s16 unk20;
    s16 unk22;
    s16 unk24;
    char pad26[0x2];
    u16 unk28;
} ovl_11_func_800DCA10_t;

void ovl_11_func_800DCA10(ovl_11_func_800DCA10_t *arg0) {
    arg0->unk8 = 0;
    arg0->unkA = 0;
    arg0->unkC = 0;
    arg0->unk10 = 0;
    arg0->unk12 = 0;
    arg0->unk14 = 0;
    arg0->unk20 = 0;
    arg0->unk22 = 0;
    arg0->unk24 = 0;
    arg0->unk28 = 0x8000;
    memset(arg0, 0, 8);
}
