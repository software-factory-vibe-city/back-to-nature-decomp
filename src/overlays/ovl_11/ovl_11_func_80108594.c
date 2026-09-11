#include "common.h"

s32 ovl_11_func_80108594(s16 arg0, s32 arg1) {
    s16 temp;
    s16 b;

    b = (s16)arg1;
    temp = (s16)(arg0 % (s32)(b * 7));
    temp = temp / 7;
    if (temp >= b) {
        temp = b - 1;
    }
    return temp;
}