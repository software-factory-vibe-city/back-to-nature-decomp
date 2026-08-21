#include "common.h"

u8 D_8005E5D0;

void func_8002470C(s16 arg0) {
    s32 tv = -1;
    u8 t;
    u8 rem;

    if (arg0 != tv) {
        tv = D_8005E5D0 + 1;
        t = (u8)tv;
        rem = t - ((((t / 120U) & 0xFF)) * 120);
        D_8005E5D0 = (u8)rem;
        return;
    }
    D_8005E5D0 = 0;
}
