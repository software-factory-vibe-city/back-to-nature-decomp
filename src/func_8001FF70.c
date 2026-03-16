#include "common.h"

extern s32 D_80049A10[];

void func_8001FF70(void) {
    s32 i;
    s32 *ptr;

    i = 0x17;
    ptr = D_80049A10;
    ptr = (s32 *)((s8 *)ptr + 0x5C);
    do {
        *ptr = 0;
        i--;
        ptr--;
    } while (i >= 0);
}
