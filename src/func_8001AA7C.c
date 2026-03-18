#include "common.h"

extern u16 D_8004908C[];

u16 *func_8001AA7C(s32 arg0, u16 *arg1) {
    s32 var_a0;
    u16 *var_v1;
    u16 temp_v0;

    var_v1 = (u16 *)((u8 *)&D_8004908C + arg0 * 0xC);
    var_a0 = 5;
    do {
        temp_v0 = *var_v1;
        var_v1 = (u16 *)((u8 *)var_v1 + 2);
        var_a0 -= 1;
        *arg1 = temp_v0;
        arg1 = (u16 *)((u8 *)arg1 + 2);
    } while (var_a0 >= 0);
    return arg1;
}
