#include "common.h"

void func_8001FE00(s32 arg0) {
    register struct_80061F08 *base __asm__("a1");
    register s32 field_10 __asm__("v0");
    register s32 one __asm__("v1");
    
    base = &D_80061F08;
    field_10 = base->field_10;
    
    /* Division with zero-check - GCC doesn't generate this automatically */
    __asm__ volatile(
        ".set\tnoreorder\n"
        "div\t$zero,%0,%2\n"
        "mflo\t%0\n"
        "bnez\t%2,1f\n"
        "nop\n"
        "break\t7\n"
        "1:\n"
        ".set\treorder\n"
        : "=&r" (field_10)
        : "0" (field_10), "r" (arg0)
        : "lo"
    );
    
    base->field_0C = field_10;
    one = 1;
    base->field_04 = one;
}
