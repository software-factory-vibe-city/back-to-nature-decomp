#include "common.h"

typedef struct {
    /* 0x00 */ u16 unk0;
    /* 0x02 */ char pad_02[0x24];
    /* 0x26 */ s16 unk26;
    /* 0x28 */ char pad_28[0xC];
    /* 0x34 */ s32 unk34;
    /* 0x38 */ char pad_38[0x76];
    /* 0xAE */ u16 unkAE;
} Struct_800E2AF0;

extern u16 D_80070CF8;

s32 func_80012A34(s32 arg0);
s32 ovl_11_func_800E2824(u16 *arg0, s32 arg1);

s32 ovl_11_func_800E2AF0(Struct_800E2AF0 *arg0) {
    s32 var_a1;
    s32 var_a0;
    s32 temp_v0;

    if ((arg0->unkAE != 0) && (arg0->unk0 == 0x109)) {
        var_a1 = 0x13;
    } else if ((u32)(D_80070CF8 - 6) >= 0xF) {
        var_a1 = 0xF;
    } else {
        if (arg0->unk26 == 0xF) {
            var_a1 = 0x10;
        } else {
            var_a0 = 4;
            if (arg0->unk34 & 0x2000) {
                var_a0 = 9;
            }
            temp_v0 = func_80012A34(var_a0);
            switch (temp_v0) {
            case 0:
                var_a1 = 0x12;
                break;
            case 1:
                var_a1 = 0xE;
                break;
            case 2:
                var_a1 = 0xF;
                break;
            default:
                var_a1 = 0x12;
                break;
            }
        }
    }
    if (var_a1 != arg0->unk26) {
        ovl_11_func_800E2824((u16 *)arg0, var_a1);
    }
    return 0;
}
