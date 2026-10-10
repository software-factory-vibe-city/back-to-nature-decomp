#include "common.h"

typedef struct {
    s16 unk0;
    s16 unk2;
} M2C_f90dacf3c1c7_Ovl11ObjHead;

typedef struct {
    s32 unk0;
    s32 unk4;
    s32 unk8;
} M2C_f90dacf3c1c7_Ovl11Pos;

typedef struct {
    M2C_f90dacf3c1c7_Ovl11Pos *unk0;
    M2C_f90dacf3c1c7_Ovl11ObjHead *unk4;
    u8 pad8[0xC];
    s32 unk14;
} M2C_f90dacf3c1c7_Ovl11CheckArg;

s32 ovl_11_func_800D7EF8(s32 *arg0, u16 *arg1, u16 *arg2);

s32 ovl_11_func_800BF720(M2C_f90dacf3c1c7_Ovl11CheckArg *arg0) {
    s32 sp10[3];
    u16 sp20;
    u16 sp22;
    M2C_f90dacf3c1c7_Ovl11Pos *temp_a1;
    s32 temp_s0;
    s32 flag;
    u16 *entry;
    s32 temp_a0;

    temp_a1 = arg0->unk0;
    sp10[0] = temp_a1->unk0;
    sp10[1] = temp_a1->unk4;
    sp10[2] = temp_a1->unk8;
    flag = (arg0->unk4->unk2 != 1);
    temp_s0 = flag * 2;
    if (temp_s0 == 2) {
        return 0;
    }
    if (ovl_11_func_800D7EF8(sp10, &sp20, &sp22) == 0) {
        if (temp_s0 != 0) {
            entry = (u16 *) &D_80074124[(s16) sp22][(s16) sp20];
        } else {
            entry = (u16 *) &D_80071DFC[(s16) sp22][(s16) sp20];
        }
        temp_a0 = *entry;
        if (temp_a0 != 0x3F) {
            if (temp_a0 < 0x40) {
                if (temp_a0 < 0x3E) {
                    if (temp_a0 < 0x3B) {
                        goto ret0;
                    }
                    goto ret1;
                }
                goto ret0;
            }
            if (temp_a0 < 0x175) {
                if (temp_a0 < 0x16C) {
                    goto ret0;
                }
                goto ret1;
            }
            goto ret0;
        }
    ret1:
        return 1;
    ret0:
        return 0;
    }
    return 0;
}
