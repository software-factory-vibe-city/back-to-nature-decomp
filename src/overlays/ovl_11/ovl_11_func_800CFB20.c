#include "common.h"

typedef struct {
    /* 0x00 */ u16 field_0;
    /* 0x02 */ char pad_02[0x34 - 0x02];
    /* 0x34 */ s32 field_34;
} Ovl11FuncCFAD0Flag;

s32 ovl_11_func_800CFB20(s32 arg0, s32 arg1, s32 arg2, s32 arg3) {
    auto s32 nested_ovl_11_func_800CFAD0(Ovl11FuncCFAD0Flag *arg0, s32 arg1) __asm__("ovl_11_func_800CFAD0");
    unsigned char *var_s0;
    unsigned char *base;
    s32 *var_s2;
    s32 var_s1;

    if (arg0 & 3) {
        var_s1 = 0;
        var_s2 = &D_800749F4;
        base = (unsigned char *) &D_8006C838;
        var_s0 = base + 0x81F0;
loop_2:
        if ((*(s32 *) var_s0 & 0x10000) ? (arg0 & 2) : (arg0 & 1)) {
            if (nested_ovl_11_func_800CFAD0((Ovl11FuncCFAD0Flag *) var_s2, arg1)) {
                return 1;
            }
        }
        var_s2 += 0x2E;
        var_s1 += 1;
        var_s0 += 0xB8;
        if (var_s1 < 0x14) {
            goto loop_2;
        }
    }
    var_s1 = 0;
    if (arg0 & 4) {
        var_s0 = (unsigned char *) &D_800742EC;
loop_11:
        if (nested_ovl_11_func_800CFAD0((Ovl11FuncCFAD0Flag *) var_s0, arg1)) {
            return 1;
        }
        var_s1 += 1;
        var_s0 += 0xB4;
        if (var_s1 < 0xA) {
            goto loop_11;
        }
    }
    return 0;
}
