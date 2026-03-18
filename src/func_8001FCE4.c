#include "common.h"

void func_8001FCE4(void) {
    s32 *base;
    /* register __asm__ required: compiler uses v1 for 0x7F0000, target uses a0 */
    register s32 big __asm__("a0");
    s32 one;
    base = &D_80061F08;
    big = 0x7F0000;
    one = 1;
    base[0] = 0;
    base[1] = 0;
    base[2] = big;
    base[3] = 0;
    base[4] = big;
    base[5] = one;
}
