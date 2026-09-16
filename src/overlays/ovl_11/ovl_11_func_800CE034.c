#include "common.h"

typedef struct {
    /* 0x00 */ char pad0[0x38];
    /* 0x38 */ u16 unk38;
    /* 0x3A */ char pad3A[0x100 - 0x3A];
    /* 0x100 */ s32 unk100;
    /* 0x104 */ s32 unk104;
    /* 0x108 */ s32 unk108;
} StructOvl11CE034A;

typedef struct {
    /* 0x00 */ s32 unk0;
    /* 0x04 */ s32 unk4;
    /* 0x08 */ s32 unk8;
} StructOvl11CE034B;

extern u8 D_801281F0[];

void ovl_11_func_800CE034(StructOvl11CE034A *arg0, StructOvl11CE034B *arg1, s32 arg2) {
    u16 *var_t0;
    s32 var_a3;
    s32 var_a0;

    var_t0 = (u16 *)(D_801281F0 + arg0->unk38 * 4);
    if (arg2 == 2) {
        var_t0 = (u16 *)(D_801281F0 + arg0->unk38 * 4 + 0x10);
    }
    var_a3 = arg0->unk100;
    arg1->unk0 = var_a3;
    arg1->unk4 = arg0->unk104;
    var_a0 = arg0->unk108;
    arg1->unk8 = var_a0;
    if (arg2 == 4) {
        arg1->unk0 = var_a3 + (s16)var_t0[0] / 2;
        arg1->unk8 = var_a0 + (s16)var_t0[1] / 2;
        return;
    }
    arg1->unk0 = var_a3 + (s16)var_t0[0];
    arg1->unk8 = var_a0 + (s16)var_t0[1];
}
