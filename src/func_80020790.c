#include "common.h"

s32 SsUtKeyOffV(s16); /* extern */
void SsUtSetVVol(s16, s32, s32); /* extern */

s32 func_80020790(s16 arg0) {
    s32 temp;

    SsUtSetVVol(arg0, 0, 0);
    temp = SsUtKeyOffV(arg0);
    if (temp < 0) {
        return -1;
    }
    return 0;
}
