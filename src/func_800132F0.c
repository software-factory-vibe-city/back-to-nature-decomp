#include "common.h"

/* TU-owned globals (GP-relative accesses in target). */
s16 D_8005E294;
s32 D_8005E298;
s16 D_8005E2A0;
s16 D_8005E3CC;
s16 D_8005E3CE;
s32 D_8005E3D0;

void func_800132F0(s32 arg0, s32 arg1, s32 arg2) {
    s16 a0;
    s16 a1;
    s32 t;

    a0 = (s16) arg0;
    t = a0 + 1;
    a1 = (s16) arg1;
    D_8005E294 = 2;
    D_8005E3CC = 0;
    D_8005E3CE = (s16) t;
    D_8005E298 = 0;
    D_8005E2A0 = arg2;
    D_8005E3D0 = a1;
}
