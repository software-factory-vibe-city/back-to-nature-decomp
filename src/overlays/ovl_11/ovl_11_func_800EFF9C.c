#include "common.h"

s32 ovl_11_func_800C3548(s32 arg0);

s16 ovl_11_func_800EFF9C(void) {
    s16 temp_v1;
    s32 var_s1;
    s16 var_s2;
    char *var_s0;

    var_s2 = 0;
    var_s1 = 1;
    do {
        var_s0 = (char *)D_8006C838 + var_s1 * 0x1D4;
        if (ovl_11_func_800C3548((s16) var_s1) != 1) {
            temp_v1 = *(s16 *)(var_s0 + 0x8000 + 0x19EA);
            if (var_s2 < temp_v1) {
                var_s2 = temp_v1;
            }
        }
        var_s1 += 1;
    } while (var_s1 < 0x25);
    return var_s2;
}
