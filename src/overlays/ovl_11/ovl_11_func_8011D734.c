#include "common.h"
#include "game_types.h"

s32 func_8001FABC(s16 arg0);
s16 ovl_11_func_8011D890(Ovl11D548Arg x, s32 mode);

s32 ovl_11_func_8011D734(Ovl11D548Arg *arg0) {
    s16 *dst;
    s32 var_s1;
    s32 temp_a0;
    s32 temp_v1;

    var_s1 = 0;
    dst = &arg0->index;
    temp_a0 = ((SomeStruct *) D_8005E3A8)->field_0x0;
    temp_v1 = ((SomeStruct *) D_8005E3A8)->field_0x8;
    if (temp_a0 & 0x1000) {
        *dst = ovl_11_func_8011D890(*arg0, 0);
        func_8001FABC(5);
    } else if (temp_a0 & 0x4000) {
        *dst = ovl_11_func_8011D890(*arg0, 1);
        func_8001FABC(5);
    } else {
        if (temp_v1 & 0x40) {
            var_s1 = 1;
            func_8001FABC(0);
        } else if (temp_v1 & 0x10) {
            if (D_8012D52C != 7) {
                var_s1 = 2;
                func_8001FABC(0);
            }
        } else if (temp_v1 & 0x20) {
            var_s1 = 3;
            func_8001FABC(1);
        }
    }
    return var_s1;
}
