#include "common.h"
#include "globals_override.h"

void func_80022580(u32 *arg0, s32 arg1, s32 arg2, s32 arg3, s16 arg4, s16 arg5);
void func_80017B3C(s32 arg0, s32 arg1, s32 arg2, s32 arg3);
void func_80024A10(s32 arg0, s16 arg1, s16 arg2, s16 arg3);
void func_8001AAF4(s16 arg0, s16 arg1, s32 arg2, s16 arg3, s16 arg4);
s16 *func_8001AA7C(s32 arg0, u16 *arg1);

void func_8002348C(void) {
    s32 base;
    s32 var_s1;
    s32 var_s3;
    s32 var_s4;
    s16 end_val;
    s32 inc;
    s32 temp_s0;
    s32 temp_t0;

    temp_t0 = D_8005E3C0->field_D8;
    base = temp_t0 + 0x64;
    func_80022580(temp_t0 + 0x68, 1, 0x14, 0x38, 0x117, 0x67);
    var_s1 = 0;
    var_s4 = 0x2A0000;
    var_s3 = 0x1E0000;
    end_val = -1;
    inc = 0x400000;
    do {
        func_80024A10(base, var_s3 >> 16, 0x3C, (s16) var_s1);
        *func_8001AA7C(var_s1, &D_800A0708[0]) = end_val;
        func_80017B3C(base, (s32) &D_800A0708[0], var_s4 >> 16, 0x3C);
        var_s4 += inc;
        var_s1 += 1;
        var_s3 += inc;
    } while (var_s1 < 4);
    var_s1 = 0;
    do {
        temp_s0 = var_s1 + 1;
        func_8001AAF4((s16) temp_s0, 2, base, (s16) (((var_s1 % 7) * 0x27) + 0x1E), (s32) (s16) (((var_s1 / 7) * 0xE) + 0x58));
        var_s1 = temp_s0;
    } while (var_s1 < 0x1E);
}
