#include "common.h"

s32 func_80015B24(s32 *arg0, s32 *arg1, u16 arg2);                    /* extern */
s32 func_8001782C(s32 *arg0, s32 arg1, u16 arg2, s16 arg3, s16 arg4); /* extern */

s32 func_80016B7C(s32 *arg0, s32 arg1, s32 arg2, s32 arg3, s32 arg4) {
    s32 found;
    s32 size;

    found = func_80015B24(arg0, (s32 *)arg0[6], arg1);
    size = func_8001782C((s32 *)arg0[6], arg2, found, arg3, arg4);
    return size / 4 * 4 + 0x20;
}
