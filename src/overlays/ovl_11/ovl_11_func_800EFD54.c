#include "common.h"

s32 ovl_11_func_800EFD54(s32 arg0, s32 arg1, s32 arg2) {
    s32 *phigh;
    s16 low;
    s32 high;
    s32 v;

    v = arg2;
    low = D_80124A18[arg0].field_8;
    phigh = &D_80124A18[arg0].field_C;
    high = *phigh;
    if (v < low) {
        v = low;
    } else if (high < v) {
        v = high;
    }
    return v;
}
