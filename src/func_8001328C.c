#include "common.h"

/* TU-owned globals (GP-relative accesses in target). */
s16 D_8005E294;
s32 D_8005E298;
s16 D_8005E2A0;
s16 D_8005E3CC;
s16 D_8005E3CE;
s32 D_8005E3D0;

void func_8001328C(void) {
    s16 t;

    t = 1;
    D_8005E294 = t;
    t = 0x3C;
    D_8005E3CE = t;
    D_8005E3CC = 0;
    D_8005E298 = 0;
    t = 2;
    D_8005E2A0 = t;
    D_8005E3D0 = 0;
}
