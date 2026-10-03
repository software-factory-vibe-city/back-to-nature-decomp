#include "common.h"

s32 ratan2(s32, s32);                               /* extern */

s32 ovl_23_func_800BA368(s32 arg0, s32 arg1) {
    s32 angle;

    angle = ratan2(arg0, arg1);
    if (angle < 0) {
        angle += 0x1000;
    }
    return (angle * 0x168) / 0x1000;
}
