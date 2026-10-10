#include "common.h"

void func_80015EE8(s32 arg0, s32 arg1, s32 arg2, s32 arg3, s16 arg4, s16 arg5);
void func_80017B3C(s32 arg0, s32 arg1, s32 arg2, s32 arg3);
void ovl_11_func_800FCAF4(s16 arg0, s16 arg1, s16 arg2);

void ovl_11_func_800FC998(void) {
    Ovl11D80127274Entry *temp_s2;
    s16 temp_s1;
    s16 temp_s0;
    s32 var_s3;

    func_80017B3C(D_8005E3C0->field_D8 + 0x54, (s32) ((u8 *) D_800535E6 + D_80054BBC[0]), 0xBA, 0x14);
    var_s3 = 0;
    do {
        temp_s2 = (Ovl11D80127274Entry *) ((u8 *) D_80127274 + (var_s3 * 6));
        temp_s1 = ((var_s3 / 7) * 0x58) + 0x24;
        temp_s0 = ((var_s3 % 7) * 0x18) + 0x32;
        func_80015EE8(D_8005E3C0->field_D8 + 0x68, (s32) D_8012CE58, (s32) temp_s2->unk4, 0, (s16) temp_s1, (s16) temp_s0);
        ovl_11_func_800FCAF4(temp_s2->unk2, (s16) (temp_s1 + 0x1E), (s16) (temp_s0 + 6));
        var_s3 += 1;
    } while ((u32) var_s3 < 0x15U);
}
