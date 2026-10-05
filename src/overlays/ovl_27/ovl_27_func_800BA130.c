#include "common.h"

void func_80022580(u32 *arg0, s32 arg1, s32 arg2, s32 arg3, s16 arg4, s16 arg5);
void func_80017B3C(s32 arg0, s32 arg1, s32 arg2, s32 arg3);

void ovl_27_func_800BA130(s16 arg0) {
    s32 temp_s0;

    temp_s0 = (s32)&D_8005175C + (*D_80054BBC + D_800C4A50[arg0]);
    func_80022580((u32 *)(D_8005E3C0->field_D8 + 4), 1, 0x10, 0x10, 0x78, 0x14);
    func_80017B3C(D_8005E3C0->field_D8, temp_s0, 0x14, 0x14);
}
