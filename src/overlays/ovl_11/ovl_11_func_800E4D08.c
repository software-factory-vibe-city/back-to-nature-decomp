#include "common.h"
#include "psyq/libapi.h"

extern s32 D_801291C0;

s32 ovl_11_func_800E4B58(s32 arg0, s32 arg1);

void ovl_11_func_800E4D08(s32 arg0) {
    s16 *var_s0;
    s32 *var_s2;
    s32 var_s1;
    s32 var_s3;

    var_s3 = 0;
    var_s1 = 2;
    var_s0 = (s16 *)(arg0 + 4);
    var_s2 = &D_801291C0;
    do {
        s16 temp = *var_s0;
        if (temp & 0x3C00) {
            if (var_s3 >= 0x1A) {
                SystemError(0x41, 0x3E7);
            }
            *var_s2 = ovl_11_func_800E4B58(arg0, var_s1 - 2);
            var_s2 += 1;
            var_s3 += 1;
        }
        var_s1 += 1;
        var_s0 += 1;
    } while (var_s1 < 0x1A);
}
