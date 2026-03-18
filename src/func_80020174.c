#include "common.h"

extern s32 D_8005E550;

s32 func_80020174(s32 arg0, s32 arg1) {
    /* register __asm__ required: compiler uses v1 for &D_8006BF68 */
    register s32 *base1 __asm__("v1");
    s32 *base0;
    s32 idx;
    s32 *base2;

    base0 = &D_8006BF48;
    arg0 = arg0 * 2;
    base1 = &D_8006BF68;
    idx = D_8005E550;
    base0 = base0 + idx;
    base1 = base1 + idx;
    *base0 = arg0;
    arg0 = 1;
    base2 = &D_8006BF88 + idx;
    __asm__ volatile("" : "=r"(idx) : "0"(idx));
    __asm__ volatile("addiu\t%0,%1,1" : "=r"(idx) : "0"(idx));
    *base1 = arg0;
    *base2 = arg1;
    D_8005E550 = idx;
    return 0;
}
