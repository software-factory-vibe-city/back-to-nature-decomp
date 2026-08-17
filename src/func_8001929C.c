#include "common.h"

/* Game callee (signature from include/functions.h; local declaration per
 * project convention). */
s32 func_8001A284(s32 arg0);

s32 func_8001929C(u16 *arg0, u16 arg1, s16 arg2, u16 *arg3) {
    u16 sp10;
    u16 *cur;
    s32 sum;
    s32 count;
    s32 temp;
    s32 masked;
    s32 r;

    cur = arg0;
    sum = 0;
    count = 0;

    for (;;) {
        if (arg2 == 0 || count < arg2) {
            temp = *cur;
            masked = temp & 0xFFFF;
            if (masked == 0xFFFF) {
                count++;
                break;
            }
            if (masked == arg1) {
                sum = (sum + 1) & 0xFFFF;
            } else if (masked != 0xFFFE && (temp & 0x4000) &&
                       ((r = func_8001A284(*(volatile u16 *)cur)) != 0 ||
                        (r = D_8005F0C8[*cur & 0xFFF]) != 0)) {
                if (arg2 != 0) {
                    sum = (sum + func_8001929C((u16 *)r, arg1, (s16)(arg2 - count), &sp10)) & 0xFFFF;
                    count += sp10;
                } else {
                    sum = (sum + func_8001929C((u16 *)r, arg1, 0, 0)) & 0xFFFF;
                }
            }
            count++;
            cur++;
        } else {
            break;
        }
    }
    if (arg3 != 0) {
        *arg3 = count;
    }
    return sum;
}
