#include "common.h"

extern s32 D_800559CC[];

typedef s32 (*FuncType)(s32, s32, s32);

s32 func_800244FC(s32 arg0, s32 arg1) {
    u16 temp;
    u32 half;
    u32 quot;
    u32 rem;
    s32 v0;
    s32 v1;
    
    v1 = arg1;
    
    /* Scheduling barrier: forces compiler to emit sw $ra earlier to match target */
    __asm__ volatile("" ::: "memory");
    
    if ((u32)v1 >= 2) {
        return 0xFFFF;
    }
    
    temp = arg0;
    half = temp >> 1;
    
    /* Inline asm to force multu/mfhi pattern */
    __asm__ volatile(
        "lui\t%0, 0x9249\n\t"
        "ori\t%0, %0, 0x2493\n\t"
        "multu\t%1, %0\n\t"
        "lui\t%0, %%hi(D_800559CC)\n\t"
        "addiu\t%0, %0, %%lo(D_800559CC)\n\t"
        "sll\t%2, %2, 2\n\t"
        "addu\t%2, %2, %0\n\t"
        "lw\t%0, 0(%2)\n\t"
        "mfhi\t%1"
        : "=&r"(v0), "+r"(half), "+r"(v1)
        :
    );
    
    quot = half >> 2;
    rem = (temp - quot * 14) & 0xFFFF;
    
    return ((FuncType)v0)(rem, quot & 0xFFFF, temp);
}
