#include "common.h"

extern u16 D_80070D08;
extern u16 D_80070D0A;

typedef struct {
    /* 0x00 */ s32 unk0;
    /* 0x04 */ s32 unk4;
    /* 0x08 */ s32 unk8;
    /* 0x0C */ s32 unkC;
    /* 0x10 */ u16 unk10;
    /* 0x12 */ u16 unk12;
} Ovl11BBox; /* size 0x14 */

typedef struct {
    /* 0x00 */ s16 unk0;
    /* 0x02 */ s16 unk2;
} Ovl11ObjHead;

typedef struct {
    /* 0x00 */ s32 unk0;
    /* 0x04 */ s32 unk4;
    /* 0x08 */ s32 unk8;
} Ovl11Pos;

typedef struct {
    /* 0x00 */ Ovl11Pos *unk0;
    /* 0x04 */ Ovl11ObjHead *unk4;
    /* 0x08 */ u8 pad8[0xC];
    /* 0x14 */ s32 unk14;
} Ovl11CheckArg;

extern Ovl11BBox D_801228DC[];
extern Ovl11BBox D_80122AD0[];
extern Ovl11BBox D_80122B5C[];
extern Ovl11BBox D_80122C10[];
extern Ovl11BBox D_80122C74[];
extern Ovl11BBox D_80122D3C[];

s32 ovl_11_func_800BE5A0(Ovl11CheckArg *arg0, s32 arg1, s32 arg2, void *arg3) {
    Ovl11BBox *var_a2;
    s16 temp_a1;
    Ovl11Pos *temp_a1_2;
    s32 temp_v1;
    u32 var_a3;
    u32 var_t0;

    temp_a1 = arg0->unk4->unk2;
    if (temp_a1 == 5) {
        var_t0 = 9;
        if (D_80070D08 == 0) {
            var_t0 = 7;
            var_a2 = D_80122AD0;
        } else {
            var_a2 = D_80122B5C;
        }
    } else {
        var_t0 = 0x19;
        if (temp_a1 == 4) {
            var_t0 = 0xA;
            if (D_80070D0A == 0) {
                var_t0 = 5;
                var_a2 = D_80122C10;
            } else {
                var_a2 = D_80122C74;
            }
        } else {
            var_a2 = D_801228DC;
        }
    }
    if (arg0->unk14 & 0x20000) {
        var_t0 = 4;
        var_a2 = D_80122D3C;
    }
    for (var_a3 = 0; var_a3 < var_t0; var_a3++) {
        if (var_a2->unk10 == arg0->unk4->unk2) {
            temp_a1_2 = arg0->unk0;
            temp_v1 = temp_a1_2->unk0;
            if (var_a2->unk0 < temp_v1 && temp_v1 < var_a2->unk8) {
                if (var_a2->unk4 < temp_a1_2->unk8 && temp_a1_2->unk8 < var_a2->unkC) {
                    return 0;
                }
            }
        }
        var_a2 = (Ovl11BBox *)((u8 *)var_a2 + 0x14);
    }
    return 1;
}
