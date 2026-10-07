#include "common.h"

typedef struct {
    /* 0x00 */ u16 unk0;
    /* 0x02 */ s16 unk2;
    /* 0x04 */ u16 unk4;
    /* 0x06 */ u16 unk6;
    /* 0x08 */ u16 unk8;
    /* 0x0A */ u16 unkA;
    /* 0x0C */ u16 unkC;
    /* 0x0E */ u16 unkE;
    /* 0x10 */ u16 unk10;
} M2C_d1b1d801165c_M2C_b93e11a2_Arg0;

void ovl_11_func_800DB140(M2C_d1b1d801165c_M2C_b93e11a2_Arg0 *arg0);

void ovl_11_func_800DB2AC(M2C_d1b1d801165c_M2C_b93e11a2_Arg0 *arg0) {
    M2C_d1b1d801165c_M2C_b93e11a2_Arg0 *var_s0;
    M2C_d1b1d801165c_M2C_b93e11a2_Arg0 *var_s1;
    u32 var_s2;
    char *base;
    u16 sentinel;

    if (arg0->unk2 == 0xF) {
        base = (char *) &D_8006C838;
        base += 0x8000;
        if ((u32) ((*(u16 *) (base + 0x64C8)) - 1) < 2U) {
            return;
        }
    }
    var_s2 = 0;
    sentinel = 0xFFFF;
    var_s0 = (M2C_d1b1d801165c_M2C_b93e11a2_Arg0 *) ((u8 *) arg0 + 0x8A8);
    var_s1 = var_s0;
    do {
        if (var_s0->unk0 != sentinel) {
            ovl_11_func_800DB140(var_s1);
        }
        var_s1 += 1;
        var_s2 += 1;
        var_s0 += 1;
    } while (var_s2 < 8U);
}
