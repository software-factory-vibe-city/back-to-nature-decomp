#include "common.h"

s32 func_8001945C(u16 *arg0, u16 arg1, s16 arg2);

u16 *func_800191B4(u16 *arg0, u16 arg1, s32 arg2, s32 arg3) {
    u16 *cur;
    u16 *base;
    u16 *result;
    s32 temp;
    s32 count;
    u16 sentinel;

    cur = arg0;
    base = cur;
    count = 0;
    result = 0;
    if (arg2 == 0) {
        return 0;
    }
    sentinel = 0xFFFF;
    for (;;) {
        temp = func_8001945C(base, *cur, 0);
        if (arg3 != 0 && temp >= arg3) {
            break;
        }
        if (*cur == sentinel) {
            if (arg1 == *cur) {
                result = cur;
            }
            break;
        }
        if (*cur == arg1) {
            count++;
            if (count >= arg2) {
                result = cur;
                break;
            }
        }
        cur++;
    }
    return result;
}
