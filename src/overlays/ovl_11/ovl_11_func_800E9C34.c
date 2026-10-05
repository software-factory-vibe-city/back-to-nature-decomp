#include "common.h"

s32 ovl_11_func_800E3A94(void);

s32 ovl_11_func_800E9C34(s16 arg0) {
    Ovl11E910Entry *var_s0;
    s32 var_a0;
    Ovl11E910Entry *temp_v0;

    var_s0 = D_8006E910;
    temp_v0 = (Ovl11E910Entry *)ovl_11_func_800E3A94();
    if (temp_v0->unk2 == 0xFF) {
        var_a0 = 0;
        if (temp_v0 != var_s0) {
            while (++var_a0 < 0xCE) {
                var_s0++;
                if (temp_v0 == var_s0) {
                    break;
                }
            }
        }
        if (var_a0 == 0xCE) {
            return 0;
        }
        D_80129560[arg0] = var_a0 + 1;
    } else {
        D_80129560[arg0] = temp_v0->unk2;
    }
    return 1;
}
