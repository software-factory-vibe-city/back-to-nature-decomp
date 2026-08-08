#include "common.h"

/* D_8005E360 is a pointer to a u16 array; loaded as s32 */
s32 D_8005E360;

void func_80023A74(void) {
    char *var_v0;
    s32 var_v1;
    u16 fill;

    fill = 0xFFFF;
    var_v1 = 8;
    var_v0 = (char *)D_8005E360 + 0x10;
    do {
        *(u16 *)var_v0 = fill;
        var_v1 -= 1;
        var_v0 -= 2;
    } while (var_v1 >= 0);
}
