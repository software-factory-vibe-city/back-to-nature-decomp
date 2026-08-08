#include "common.h"

/* Globals accessed by this function */
s32 D_8005E3B0;

s32 func_8001205C(void) {
    s32 const_val;
    s32 temp;

    const_val = (s32)0xFFFB7000;
    temp = D_8005E3B0 - D_8001009C;
    temp = (temp + const_val) - D_8005E328;
    return temp - (D_8007AFF4 - D_8001009C);
}
