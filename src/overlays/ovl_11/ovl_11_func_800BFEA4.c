#include "common.h"

extern u8 D_80128820[];
extern u8 D_80125E88[];
extern s32 *D_80128A80;

void ovl_11_func_800BFF50(s32 *arg0);

void ovl_11_func_800BFEA4(void) {
    u8 *var_s1;
    s32 var_s0;

    var_s1 = D_80128820;
    var_s0 = 0x27;
    do {
        ovl_11_func_800BFF50((s32 *)var_s1);
        var_s0 -= 1;
        var_s1 += 0xE;
    } while (var_s0 >= 0);
    D_80128A80 = (s32 *)D_80125E88;
}
