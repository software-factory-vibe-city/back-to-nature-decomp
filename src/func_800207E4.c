#include "common.h"

short SsUtSetVVol(short, short, short);              /* extern */

s32 func_800207E4(s16 arg0, s16 arg1, s16 arg2) {
    SsUtSetVVol(arg0, arg1, arg2);
    return 0;
}
