#include "common.h"
#include "psyq/stddef.h"
#include "psyq/libgte.h"

extern s32 D_80122F7C;
extern s32 D_80122F80;

/* This function's two arguments view two different records; both are private
 * to this TU, so they are described locally. arg0 is the emitter state whose
 * heading fields at +0x30/+0x38 are converted to a radian-ish angle, and
 * arg1 is an event record whose -8/+4/+6/+0xA halfwords feed that heading. */
typedef struct {
    u8 pad0[6];
    u16 unk6;
    u8 pad8[4];
    s16 unkC;
    u8 padE[0x22];
    s32 unk30;
    s32 unk34;
    s32 unk38;
    u8 pad3C[0x14];
    s32 unk50;
    s32 unk54;
    s32 unk58;
} Ovl11C3B78Arg0;

typedef struct {
    u16 unk0;
    u16 unk2;
    u16 unk4;
    s16 unk6;
    s16 unk8;
    s16 unkA;
} Ovl11C3B78Arg1;

typedef struct {
    u8 pad0[8];
    u16 unk8;
} Ovl11C3B78View;

void ovl_11_func_800C3B78(Ovl11C3B78Arg0 *arg0, Ovl11C3B78Arg1 *arg1) {
    u16 temp_v1;
    s32 temp_a2;
    s32 temp_a1;
    s32 var_s0;
    s32 temp_s1;
    char *far_base;

    temp_v1 = arg1->unk0;
    if ((temp_v1 == 3) || (temp_v1 == 9) || (temp_v1 == 0x11) || (temp_v1 == 0x12)) {
        arg0->unk50 = 0;
        arg0->unk54 = 0;
        arg0->unk58 = 0;
        return;
    }
    if (arg0->unkC == 0) {
        arg0->unk6 = arg1->unk4;
    } else {
        arg0->unk6 = *(u16 *)((u8 *)arg1 - 8);
    }
    temp_a2 = ((arg0->unk30 - arg1->unk6) * 0x3E8) + 1;
    temp_a1 = ((arg0->unk38 - arg1->unkA) * 0x3E8) + 1;
    if ((temp_a2 == 1) && (temp_a1 == temp_a2)) {
        arg0->unk50 = 0;
        arg0->unk54 = 0;
        arg0->unk58 = 0;
    } else {
        temp_s1 = ratan2(temp_a2, temp_a1) + 0x800;
        var_s0 = D_80122F7C;
        far_base = (char *)&D_8007AFF0;
        if ((*(Ovl11C3B78View **)(far_base + 0x25388))->unk8 & 0x1000) {
            var_s0 = D_80122F80;
        }
        arg0->unk50 = var_s0 * rsin(temp_s1);
        arg0->unk58 = var_s0 * rcos(temp_s1);
    }
}
