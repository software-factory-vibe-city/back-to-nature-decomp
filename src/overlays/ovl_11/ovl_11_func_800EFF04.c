#include "common.h"

u8 *ovl_11_func_800EFF04(s32 arg0, s32 arg1, s32 *arg2) {
    s32 local;
    u8 *p;
    s16 n;

    if (arg2 == 0) {
        arg2 = &local;
    }
    n = D_80124A18[arg0].field_6;
    if (n != 0) {
        p = D_80124A18[arg0].field_0 + n * arg1;
    } else {
        p = D_80124A18[arg0].field_0;
    }
    *arg2 = D_80124A18[arg0].field_4;
    if (p == 0) {
        do {
        } while (func_800129E8() != 0);
    }
    return p;
}
