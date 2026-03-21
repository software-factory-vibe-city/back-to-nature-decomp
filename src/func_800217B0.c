#include "common.h"

extern s32 D_80049A10[3];

s32 func_800217B0(s32 arg0, s32 arg1, s32 arg2, u8 *arg3) {
    s32 *v1;
    s32 three;
    u8 temp;
    s32 *base;

    three = 3;
    if (arg2 < arg1) {
        goto done;
    }
    base = &D_80049A10[0];
    __asm__ volatile("" : "=r"(base) : "0"(base));
    v1 = (s32 *)((arg1 << 2) + (s32)base);
loop:
    temp = arg3[arg1];
    if ((temp == 0) || (temp == three)) {
        if ((u32)(*v1 - arg0) >= 2U) {
            return arg1;
        }
    }
    arg1 += 1;
    v1++;
    if (arg2 >= arg1) {
        goto loop;
    }
done:
    return -1;
}
