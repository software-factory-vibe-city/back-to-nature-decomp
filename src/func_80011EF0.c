#include "common.h"

/* Tentative definitions so cc1 keeps these inside the -G8 small-data range
 * (project idiom: commons merge across TUs — see func_80011C24.c). */
s32 D_8005E394;
s32 D_8005E39C;
s32 D_8005E3A0;

void func_80011EF0(s32 arg0) {
    s32 temp_v0;

    temp_v0 = D_8005E39C;
    D_8005E3A0 = 0;
    D_8005E39C = arg0;
    D_8005E394 = temp_v0;
}
