#include "common.h"

typedef struct {
    char pad_00[0x24];
    /* 0x24 */ s16 unk24;
    /* 0x26 */ s16 unk26;
    /* 0x28 */ s16 unk28;
    /* 0x2A */ s16 unk2A;
    /* 0x2C */ s16 unk2C;
    char pad_2E[0x30 - 0x2E];
    /* 0x30 */ s16 unk30;
    char pad_32[0x34 - 0x32];
    /* 0x34 */ s32 unk34;
    char pad_38[0x7A - 0x38];
    /* 0x7A */ u16 unk7A;
} Ovl11D04D4Obj;

s32 ovl_11_func_800D04D4(Ovl11D04D4Obj *arg0, u8 *arg1, s16 *arg2, s32 arg3, u16 *arg4);

extern u8 D_80127A90;

s32 ovl_11_func_8010A02C(Ovl11D04D4Obj *arg0) {
    s16 temp_v1;
    s32 var_s1;

    temp_v1 = arg0->unk28;
    var_s1 = 0;
    switch (temp_v1) {                              /* irregular */
    case 0:
        arg0->unk28 = 1;
        arg0->unk34 |= 0x800;
        break;
    case -1:
        var_s1 = 1;
        arg0->unk2C = 0x12C;
        arg0->unk34 &= ~0x800;
        break;
    case 1:
    default:
        if (ovl_11_func_800D04D4(arg0, &D_80127A90, &arg0->unk28, -1, (u16 *)&arg0->unk2A) != 0) {
            arg0->unk28 = -1;
        }
        break;
    }
    return var_s1;
}
