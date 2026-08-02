#include "common.h"

void func_80016280(s32, s32, s32, s32, u8, u8, s16, s16);
s32 func_80011F5C(s32);
void func_80011FD8(s32);

void func_80015EE8(s32 arg0, s32 arg1, s32 arg2, s32 arg3, s16 arg4, s16 arg5) {
    s32 var_s0;
    s32 var_s1;
    s32 var_s2;
    s32 var_s3;
    s32 var_s4;
    s32 var_s5;
    s32 var_sp20;

    var_s4 = arg0;
    var_s2 = arg4;
    var_s3 = arg5;
    var_s5 = arg1;
    var_s0 = arg2 & 0xFF;
    var_s1 = arg3 & 0xFF;

    var_sp20 = func_80011F5C(0);
    func_80016280(var_s4, &var_sp20, &var_sp20, var_s5, var_s0, var_s1, (s32) var_s2, (s32) var_s3);
    func_80011FD8(var_sp20);
}
