#include "common.h"

/* Pointer-returning zero-argument interface also used by the matched
 * BF3D0/BF3F4 siblings; the getter itself has no published definition. */
void *func_8001EF98(void);

/* User-authorized matching workarounds: bind the low halfword to a0 and
 * preserve the original zero/dead-ORI tail. Neither proves original source. */
s32 ovl_11_func_800BF450(void) {
    u32 *p;
    u32 v;
    s32 result;
    register u32 low asm("$4");

    p = func_8001EF98();
    D_80128808 = p;
    if (p == 0) {
        return 1;
    }
    v = *p;
    low = v & 0xFFFF;
    D_8012880C = low;
    if ((v & 0x2000) == 0) {
        asm volatile("addu %0,$0,$0\n\tori $3,$0,0x8000"
                     : "=r"(result) : : "$3");
        return result;
    }
    return 0;
}
