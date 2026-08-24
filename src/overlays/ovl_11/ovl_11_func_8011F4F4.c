#include "common.h"

extern u16 D_80075854;

s32 ovl_11_func_8011F4F4(void) {
    s32 var_a1;
    s32 var_v1;
    u16 *var_a0;

    var_a1 = 0;
    var_a0 = &D_80075854;
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
