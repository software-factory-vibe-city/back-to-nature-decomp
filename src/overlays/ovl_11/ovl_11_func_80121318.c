#include "common.h"

extern u8 D_8012DB90[];

void ovl_11_func_80121318(void) {
    u8 *var_s1;
    s32 var_s0;

    var_s1 = D_8012DB90;
    var_s0 = 0x18;
    do {
        ovl_11_func_801214F8((s32 *)var_s1);
        var_s0 -= 1;
        var_s1 += 0x18;
    } while (var_s0 >= 0);
}
