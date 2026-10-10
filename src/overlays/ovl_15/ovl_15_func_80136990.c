#include "common.h"
#include "game_types.h"
#include "psyq/stddef.h"
#include "psyq/libgte.h"


void func_80022580 (u32 *arg0, s32 arg1, s32 arg2, s32 arg3, s16 arg4, s16 arg5);
void func_80017B3C (s32 arg0, s32 arg1, s32 arg2, s32 arg3);
s32 func_8001FABC (s16 arg0);
void func_800248B0 (s32 arg0, s16 arg1, s16 arg2);

s8 ovl_15_func_80136990(void) {
    s32 temp_v0;
    s32 temp_v0_2;

    func_80022580((u32 *) (D_8005E3C0->field_D8 + 0x18), 1, 0x4E, 0x48, 0xA3, 0x22);
    func_80017B3C(D_8005E3C0->field_D8 + 0x14, (s32) ((u8 *) D_80051D18 + D_80054BBC[0]), 0x5F, 0x4C);
    temp_v0 = *(s32 *) ((u8 *) D_8005E3A8 + 0);
    if (temp_v0 & 0x4000) {
        func_8001FABC(5);
        D_80137587 = (u8) D_80137587 + 1;
    } else if (temp_v0 & 0x1000) {
        func_8001FABC(5);
        D_80137587 = (u8) D_80137587 - 1;
    }
    if (D_80137587 < 0) {
        D_80137587 = 1;
    }
    if (D_80137587 >= 2) {
        D_80137587 = 0;
    }
    func_800248B0(D_8005E3C0->field_D8 + 4, 0x5C, (D_80137587 * 0xD) + 0x52);
    temp_v0_2 = *(s32 *) ((u8 *) D_8005E3A8 + 8);
    if (temp_v0_2 & 0x40) {
        func_8001FABC(0);
        return D_80137587;
    }
    if (temp_v0_2 & 0x20) {
        func_8001FABC(1);
        return -1;
    }
    return 2;
}
