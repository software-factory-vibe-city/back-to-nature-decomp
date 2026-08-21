#include "common.h"

u8 D_8005E5D1;

void func_8002495C(s16 arg0) {
    s32 tv = -1;
    u8 t;
    u8 rem;

    if (arg0 != tv) {
        tv = D_8005E5D1 + 1;
        t = (u8)tv;
        rem = t - ((((t / 60U) & 0xFF)) * 60);
        D_8005E5D1 = (u8)rem;
        return;
    }
    D_8005E5D1 = 0;
}
