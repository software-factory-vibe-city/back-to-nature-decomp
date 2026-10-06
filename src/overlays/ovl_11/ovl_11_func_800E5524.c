#include "common.h"

void ovl_11_func_800E5524(u8 *arg0, u8 *arg1, s32 arg2) {
    u8 delim;
    s32 cnt;
    u8 ch;
    u8 fill_char;
    s32 fill_count;

    delim = *arg1++;
    for (cnt = 0; cnt < arg2; cnt++, arg1++) {
        ch = *arg1;
        if (ch == delim) {
            arg1++;
            fill_char = *arg1++;
            fill_count = *arg1;
            if (fill_count != 0) {
                do {
                    *arg0++ = fill_char;
                    fill_count--;
                } while (fill_count != 0);
            }
        } else {
            *arg0++ = ch;
        }
    }
}
