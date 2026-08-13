#include "common.h"

/* Tentative definitions — this TU owns these GP-relative globals. */
s32 D_8005E538;
s32 D_8005E54C;
s32 D_8005E554;
s16 D_8005E572;

void func_800214FC(s16 arg0) {
    s32 temp;

    D_8005E572 = arg0;
    if ((&D_8006BF48)[D_8005E554] >= 0) {
        if ((&D_8006BF68)[D_8005E554] != 0) {
            temp = D_80049370[arg0];
            func_80014988(9, temp, D_80049370[arg0 + 2] - temp, D_8005E54C, 1);
            D_8005E538 = 0x32;
            return;
        }
        temp = D_80049370[arg0];
        func_80014988(9, temp, D_80049370[arg0 + 1] - temp, D_8005E54C, 1);
        D_8005E538 = 0x1E;
        return;
    }
    D_8005E538 = 0;
}
