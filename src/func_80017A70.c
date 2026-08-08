#include "common.h"

s16 D_8005E44C;

/*
 * Sets D_8005E44C by looking up arg0 in the table D_80049050.
 * If arg0 >= 3, it is clamped to 1 (the index of the last valid
 * entry). The table holds u16 values; the selected entry is stored
 * into D_8005E44C via a GP-relative half-word store.
 */
void func_80017A70(u32 arg0) {
    if (arg0 >= 3) {
        arg0 = 1;
    }

    D_8005E44C = D_80049050[arg0];
}
