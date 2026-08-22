#include "common.h"

/* TU-owned globals (GP-relative accesses in target). */
s32 D_8005E28C;
s16 D_8005E294;
s32 D_8005E298;
s16 D_8005E2A0;
s16 D_8005E3CC;
s16 D_8005E3CE;
s32 D_8005E3D0;

void func_80013328(s16 arg0) {
    s32 var_v0;
    s32 t;

    t = 3;
    D_8005E294 = t;
    D_8005E3CC = 0;
    if (arg0 >= 0x1F) {
        arg0 = 0x1E;
        D_8005E3CE = arg0;
    }
    var_v0 = arg0 + 1;
    D_8005E3CE = var_v0;
    D_8005E28C = 1;
    D_8005E298 = 1;
    SetVal8005E278(0);
    SetVal8005E27C(0);
    t = 2;
    D_8005E2A0 = t;
    D_8005E3D0 = 0;
}
