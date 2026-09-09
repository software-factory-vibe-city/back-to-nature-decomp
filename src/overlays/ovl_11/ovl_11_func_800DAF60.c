#include "common.h"

extern Ovl11D124Entry D_80071DFC[25][45];

Ovl11D124Entry *ovl_11_func_800DAF60(s32 arg0, s16 arg1, s16 arg2) {
    Ovl11D124Entry *base;
    s32 height;
    s32 width;
    Ovl11D124Entry *ret;

    ret = 0;
    if (arg0 == 0) {
        height = 0x19;
        width = 0x2D;
        base = &D_80071DFC[0][0];
    } else {
        height = 7;
        width = 7;
        base = &D_80074124[0][0];
    }
    if ((arg1 >= 0) && (arg1 < width) && (arg2 >= 0) && (arg2 < height)) {
        ret = base + (arg2 * width + arg1);
    }
    return ret;
}