#include "common.h"

s16 *func_8001A970(s32 arg0, s16 *arg1, s32 arg2);

s16 *func_8001A870(s32 arg0, s16 *arg1, s32 arg2) {
    s16 *p;

    p = func_8001A970(arg0, arg1, arg2 - 1);
    *(u16 *)p = 0xFFFF;
    if ((u16)*arg1 != 0xFFD) {
        return arg1;
    }
    do {
        arg1++;
    } while ((u16)*arg1 == 0xFFD);
    return arg1;
}
