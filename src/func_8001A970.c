#include "common.h"

s16 *func_8001A970(s32 arg0, s16 *arg1, s32 arg2) {
    s32 negative;
    s32 i;
    s32 seen_nonzero;
    s8 buffer[16];

    /* Cap arg2 */
    if (arg2 >= 10) {
        arg2 = 10;
    }

    /* Check sign and negate */
    negative = (arg0 >> 31) & 1;
    if (negative) {
        arg0 = -arg0;
    }

    /* Convert to base-10 digits (for loop) */
    for (i = 0; i < arg2; i++) {
        buffer[i] = arg0 % 10;
        arg0 /= 10;
    }

    /* Store special marker if negative */
    if (negative) {
        buffer[arg2 - 1] = 10;
    }

    /* Convert digits to display characters */
    seen_nonzero = 0;
    i = arg2 - 1;
    if (i >= 0) {
        do {
            if ((u8)buffer[i] == 10) {
                *arg1 = 0x69;
            } else if ((seen_nonzero == 0) && ((u8)buffer[i] == 0) && (i != 0)) {
                *arg1 = 0xFFD;
            } else {
                seen_nonzero += (u8)buffer[i];
                *arg1 = (u8)buffer[i] + 0x40;
            }
            arg1++;
        } while (--i >= 0);
    }

    return arg1;
}
