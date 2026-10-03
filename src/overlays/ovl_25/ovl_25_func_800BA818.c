#include "common.h"

extern s16 D_800BFE46;

s32 func_800226A4(void);

void ovl_25_func_800BA818(void) {
    s32 var_v1;

    func_8002261C(4, 0x31);
    var_v1 = func_800226A4();
    if (var_v1 == 2) {
        D_800BFE46 = var_v1;
    }
}
