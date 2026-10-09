#include "common.h"

s32 func_8001AF44(u32 arg0);
void func_8001AF70(u16 arg0, u16 arg1);

typedef struct {
    /* 0x00 */ u8 pad[0x2E];
    /* 0x2E */ u16 unk2E;
    /* 0x30 */ u16 unk30;
} Ovl11FuncD5B0Sub;

typedef struct {
    /* 0x00 */ u8 pad[0x28];
    /* 0x28 */ u16 unk28;
    /* 0x2A */ u8 pad2[0x2];
    /* 0x2C */ Ovl11FuncD5B0Sub *unk2C;
} Ovl11FuncD5B0Entry;

void ovl_11_func_800DD5B0(void) {
    s16 var_a1;
    s32 temp_v0;
    s32 var_a0;
    s32 var_a3;
    u16 temp_v1;
    Ovl11FuncD5B0Entry *var_a2;
    Ovl11FuncD5B0Sub *temp_a0;

    var_a2 = (Ovl11FuncD5B0Entry *)D_80128E08;
    D_80129190 = 0;
    D_80129188[0] = 0;
    D_80129188[1] = 0;
    for (var_a3 = 0; var_a3 < 0xF; var_a3++, var_a2++) {
        temp_v1 = var_a2->unk28;
        if (temp_v1 & 0x80) {
            temp_v0 = temp_v1 & 0xF;
            switch (temp_v0) {
            case 0:
                var_a1 = 8;
                var_a2->unk28 = temp_v1 & 0xEFFF;
                var_a0 = 0;
                break;
            case 1:
                var_a2->unk28 = temp_v1 | 0x1000;
                var_a1 = 0xC;
                var_a0 = 1;
                break;
            default:
                var_a0 = 0;
                var_a1 = 0;
                break;
            }
            var_a2->unk2C->unk2E = 0;
            var_a2->unk2C->unk30 = var_a1;
            D_80129188[var_a0] = (u8 *)var_a2;
        }
    }
    func_8001AF70(9, 0);
    if (func_8001AF44(0xA) == 1) {
        D_80129190 = 3;
        ((Ovl11FuncD5B0Entry *)D_80129188[0])->unk28 |= 0x1000;
        ((Ovl11FuncD5B0Entry *)D_80129188[1])->unk28 &= 0xEFFF;
        temp_a0 = ((Ovl11FuncD5B0Entry *)D_80129188[1])->unk2C;
        temp_a0->unk2E = temp_a0->unk30;
    }
}
