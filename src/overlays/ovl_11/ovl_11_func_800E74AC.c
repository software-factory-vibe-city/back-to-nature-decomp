#include "common.h"

/* User-authorized parked recovery: real register roles and five arithmetic
 * instructions preserve limit-conversion and comparison births. Inputs are
 * explicitly narrowed to signed low halfwords; both absolute-value guards,
 * field reads and the return remain C. */

s32 ovl_11_func_800E74AC(s32 arg0, s32 arg1, s32 arg2, s32 arg3) {
    register s32 result __asm__("$8");
    register s16 *p __asm__("$3");
    register s32 delta __asm__("$2");
    register s32 y __asm__("$3");
    register s32 xlimit __asm__("$4");
    register s32 ylimit __asm__("$5");

    result = 0;
    xlimit = arg0;
    ylimit = arg1;
    __asm__("sll %0,%0,16\n\tsra %0,%0,16\n\tsll %1,%1,16"
            : "+r"(xlimit), "+r"(ylimit));
    p = (s16 *)&D_8006C838;
    delta = p[0x2964];
    y = p[0x2968];
    delta = delta - arg2;
    if (delta < 0) {
        delta = -delta;
    }
    if (delta < xlimit) {
        ylimit = ylimit >> 16;
        __asm__("subu %0,%1,%2" : "=r"(delta) : "r"(y), "r"(arg3));
        if (delta < 0) {
            delta = -delta;
        }
        __asm__("slt %0,%1,%2" : "=r"(result) : "r"(delta), "r"(ylimit));
    }
    return result;
}
