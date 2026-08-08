#include "common.h"

u32 D_8005E450;

void func_80017A48(u32 arg0) {
    u32 var_a0;

    var_a0 = arg0;
    if (var_a0 >= 7U) {
        var_a0 = 6;
    }
    D_8005E450 = var_a0;
}
