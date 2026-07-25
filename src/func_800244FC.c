#include "common.h"

extern s32 D_800559CC[];

typedef s32 (*FuncType)(s32, s32, s32);

s32 func_800244FC(s32 arg0, s32 arg1) {
    u16 temp;
    u32 quot;
    u32 rem;
    FuncType fn;

    /* Keep the prologue's sw ra ahead of the branch: without the barrier the
       post-reload scheduler moves it into the beqz delay slot. */
    __asm__ volatile("" ::: "memory");

    if ((u32)arg1 >= 2) {
        return 0xFFFF;
    }
    temp = arg0;
    quot = temp / 14;
    rem = temp % 14;
    fn = (FuncType)D_800559CC[arg1];
    return fn(rem, quot, temp);
}
