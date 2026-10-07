#include "common.h"

extern u16 D_800A03B0;

typedef struct {
    u16 unk0;
    u16 unk2;
    u16 unk4;
    u16 unk6;
    u16 unk8;
    u16 unkA;
    u16 unkC;
    u16 unkE;
    u16 unk10;
} M2C_b93e11a2_Arg0;

typedef struct {
    u16 unk0;
    u16 unk2;
    u16 unk4;
    u16 unk6;
    u16 unk8;
    u16 unkA;
    u16 unkC;
    u16 unkE;
    u16 unk10;
    u16 unk12;
    u16 unk14;
} M2C_b93e11a2_Entry;

void ovl_11_func_800DB140(M2C_b93e11a2_Arg0 *arg0) {
    s32 i;
    M2C_b93e11a2_Entry *p;

    p = (M2C_b93e11a2_Entry *) &D_800A03B0;
    for (i = 0; i < 8; i++, p++) {
        if (arg0->unk0 == p->unk0) {
            return;
        }
    }
    p = (M2C_b93e11a2_Entry *) &D_800A03B0;
    for (i = 0; i < 8; i++, p++) {
        if (p->unk0 == 0xFFFF) {
            memset(p, 0, 0x16);
            p->unk0 = arg0->unk0;
            p->unk2 = arg0->unk2;
            p->unk8 = arg0->unk4;
            p->unk4 = arg0->unk6;
            p->unk6 = arg0->unk8;
            p->unkE = arg0->unkA;
            p->unk10 = arg0->unkC;
            p->unk12 = arg0->unkE;
            p->unk14 = arg0->unk10;
            return;
        }
    }
}
