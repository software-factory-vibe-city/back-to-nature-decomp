#include "common.h"

s32 ovl_11_func_800F2354(s32 arg0, s32 arg1) {
    s32 *base;
    s32 *pos;
    s32 *neg;
    s32 var;
    s32 value;
    s32 t;
    s32 ret;

    if (arg0 == 0) {
        return 0;
    }

    base = (s32 *)&D_8006C838;
    ret = 0;
    var = base[0x1489];
    var += arg0;
    if (var < 0) {
        ret = 2;
        if (arg1 != 0) {
            base[0x1489] = 0;
            arg0 = arg0 - var;
        } else {
            arg0 = 0;
        }
    } else if (0x98967E < var) {
        ret = 1;
        base[0x1489] = 0x98967F;
    } else {
        base[0x1489] = var;
    }

    if (arg0 > 0) {
        pos = (s32 *)&D_8006C838;
        pos[0x1271] += arg0;
    } else {
        neg = (s32 *)&D_8006C838;
        value = neg[0x1272];
        t = arg0 < 0 ? -arg0 : arg0;
        value += t;
        neg[0x1272] = value;
    }
    return ret;
}
