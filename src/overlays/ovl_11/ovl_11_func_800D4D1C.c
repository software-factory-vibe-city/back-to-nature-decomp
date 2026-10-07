#include "common.h"
#include "game_types.h"

typedef struct {
    char pad_00[0x22];
    /* 0x22 */ u16 unk22;
    /* 0x24 */ s16 unk24;
    /* 0x26 */ s16 unk26;
    /* 0x28 */ s16 unk28;
    /* 0x2A */ s16 unk2A;
    /* 0x2C */ s16 unk2C;
    char pad_2E[0x30 - 0x2E];
    /* 0x30 */ s16 unk30;
    char pad_32[0x34 - 0x32];
    /* 0x34 */ s32 unk34;
    char pad_38[0x48 - 0x38];
    /* 0x48 */ Recon800D0408A1View unk48;
    char pad_54[0x7A - 0x54];
    /* 0x7A */ u16 unk7A;
} Ovl11D4D1CObj;

void ovl_11_func_800D3200(s32 arg0);
s32 ovl_11_func_800D04D4(Ovl11D4D1CObj *arg0, u8 *arg1, s16 *arg2, s32 arg3, u16 *arg4);
s32 ovl_11_func_800D0408(u16 arg0, Recon800D0408A1View *arg1, s32 arg2);

extern u8 D_80123C70;

s32 ovl_11_func_800D4D1C(Ovl11D4D1CObj *arg0) {
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
        ovl_11_func_800D3200((s32)arg0);
        var_s1 = 1;
        break;
    case 1:
    default:
        if (ovl_11_func_800D04D4(arg0, &D_80123C70, &arg0->unk28, -1, (u16 *)&arg0->unk2A) != 0) {
            arg0->unk28 = -1;
        } else if (arg0->unk28 == 2) {
            ovl_11_func_800D0408(arg0->unk22, &arg0->unk48, 0x3C);
        }
        break;
    }
    return var_s1;
}
