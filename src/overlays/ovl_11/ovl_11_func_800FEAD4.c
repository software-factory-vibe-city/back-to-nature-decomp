#include "common.h"

s32 ovl_11_func_800FEAD4(void) {
    s32 var_a1;
    s32 var_v1;
    u16 *var_a0;
    char *base;

    var_a1 = 0;
    base = (char *)&D_8006C838;
    base += 0x901C;
    var_a0 = (u16 *)base;
    var_v1 = 0x62;
    do {
        if (*var_a0 != 0) {
            var_a1 += 1;
        }
        var_v1 -= 1;
        var_a0 += 2;
    } while (var_v1 >= 0);
    return var_a1;
}
