#include "common.h"

/* ovl_11_func_800E63C8's own source declares (s16, s16); the target call
 * also clears a2 and a3 before the jal, so the caller TU declares the full
 * 4-argument interface here. */
s32 ovl_11_func_800E63C8(s16 arg0, s16 arg1, s32 arg2, s32 arg3);

void func_800132B8(s32 arg0, s32 arg1, s32 arg2);
void func_800132F0(s32 arg0, s32 arg1, s32 arg2);
s32 func_80013394(void);

s32 ovl_11_func_800E6D2C(s16 arg0, s16 arg1, s32 arg2, s32 arg3) {
    s32 var_a1;
    s32 var_a2;
    void (*var_v0)(s32, s32, s32);

    if (arg2 != 0) {
        var_a1 = 0;
        if (arg0 != 2) {
            var_a2 = 2;
            if (arg0 >= 3) {
                if (arg0 != 3) {

                } else {
                    goto block_6;
                }
            }
        } else {
            ovl_11_func_800E63C8(0, 0, 0, 0);
block_6:
            var_a1 = 1;
            var_a2 = 2;
        }
        if (arg3 != 0) {
            var_a2 = 1;
        }
        if (arg0 & 1) {
            var_v0 = func_800132B8;
        } else {
            var_v0 = func_800132F0;
        }
        var_v0((s32) arg1, var_a1, var_a2);
        return 0;
    }
    return func_80013394() == 1;
}
