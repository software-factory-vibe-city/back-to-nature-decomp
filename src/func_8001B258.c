#include "common.h"

extern void (*D_8001021C[])(s32);
extern s16 D_8005E4C4;

void func_8001B258(void) {
    s32 var_s0 = 0;
    s16 *var_s1;
    void (*temp_v0)(s32);
    void (**arr)(s32) = D_8001021C;

    var_s1 = &D_8005E4C4;
    do {
        temp_v0 = arr[*var_s1];
        if (temp_v0 != 0) {
            temp_v0(var_s0);
        }
        var_s0 += 1;
        var_s1 += 1;
    } while ((u32)var_s0 < 2U);
}
