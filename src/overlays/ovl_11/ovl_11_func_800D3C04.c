#include "common.h"

s32 func_80012A34(s32 arg0);

s32 ovl_11_func_800D3C04(void *arg0) {
    s32 var_a0 = 3;
    s32 temp_v0;
    s32 var_v1;

    if (*(u32 *)((char *)arg0 + 0x34) & 0x2000) {
        var_a0 = 8;
    }
    temp_v0 = func_80012A34(var_a0);
    var_v1 = 8;
    if (temp_v0 != 0) {
        var_v1 = 1;
        if (temp_v0 == 1) {
            var_v1 = 9;
        }
    }
    return var_v1;
}
