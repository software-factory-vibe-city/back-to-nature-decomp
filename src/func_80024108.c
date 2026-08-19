#include "common.h"
#include "globals_override.h"

void func_80022580(u32 *arg0, s32 arg1, s32 arg2, s32 arg3, s16 arg4, s16 arg5);
void func_80017B3C(s32 arg0, s32 arg1, s32 arg2, s32 arg3);

void func_80024108(s32 arg0, s32 arg1) {
    s32 tmp = arg1 & 0xFFFF;
    s32 sum;
    s32 base;

    SetVal8005E334(0);
    SetVal8005E2BC(0);
    func_8002261C(3, arg0);
    if (func_800226B0() != 0) {
        base = D_8005E3C0->field_D8 + 0x58;
        sum = *D_80054BBC + (s32)&D_8005175C;
        func_80017B3C(base, sum, 0x93, 0x4E);
        func_80022580(D_8005E3C0->field_D8 + 0x5C, 1, 0x91, 0x4C, 0x28,
                      0x1E);
        func_800248B0(D_8005E3C0->field_D8 + 0x54, 0x99, (s16)(tmp * 0xC + 0x54));
    }
}

