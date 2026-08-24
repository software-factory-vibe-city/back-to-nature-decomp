#include "common.h"

void ovl_11_func_800DD248(u16 *arg0, u16 *arg1, u32 arg2) {
    u16 *var_a0;
    u16 *var_a1;
    u16 temp_v0;
    u32 var_v1;

    var_a0 = arg0;
    var_a1 = arg1;
    var_v1 = 0;
    if (arg2 != 0) {
        do {
            temp_v0 = *var_a1;
            var_a1 += 1;
            var_v1 += 1;
            *var_a0 = temp_v0;
            var_a0 += 1;
        } while (var_v1 < arg2);
    }
}
