#include "common.h"

extern s32 D_80049A10[];

void func_8001FF70(void) {
    s32 i;

    i = 23;
    do {
        D_80049A10[i] = 0;
        i--;
    } while (i >= 0);
}
