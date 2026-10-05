#include "common.h"

void ovl_11_func_800F5160(s16 arg0, s16 arg1, void *arg2);

void ovl_11_func_800F508C(s16 arg0) {
    s16 *var_s1;
    s16 temp_a1;
    s32 var_s0;
    void **var_s2;
    char *base;
    void *temp_a2;

    base = (char *)&D_8006C838;
    var_s2 = (void **)(base + 0xDD8C);
    var_s1 = (s16 *)(base + 0xDDD8);
    var_s0 = 0x12;
    do {
        temp_a2 = *var_s2;
        var_s2 += 1;
        temp_a1 = *var_s1;
        var_s1 += 1;
        var_s0 -= 1;
        ovl_11_func_800F5160(arg0, temp_a1, temp_a2);
    } while (var_s0 >= 0);
}
