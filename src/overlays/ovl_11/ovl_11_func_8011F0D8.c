#include "common.h"

extern s32 D_8012DB10;
extern s32 D_8012DB14;

void ovl_11_func_8011F0D8(s32 arg0) {
    s32 var_a0;

    var_a0 = arg0;
    if (D_8012DB10 == 0) {
        D_8012DB10 = 1;
        if (var_a0 < 0) {
            var_a0 = 0;
        }
        if (var_a0 >= 0xA) {
            var_a0 = 9;
        }
        D_8012DB14 = var_a0;
    }
}
