#include "common.h"

/* User-authorized matching workaround: keep the address high fragment in a2
 * and re-form its low fragment before/after the C copy loop; bind the final
 * pointer to v0. This does not establish original handwritten source. */
s32 ovl_11_func_800DDDBC(void) {
    register u32 high asm("$6");
    s32 *base;
    register s32 *tail asm("$2");
    s32 *a;
    s32 c;

    c = 2;
    asm volatile("lui %0,%%hi(D_8006C838)" : "=r"(high));
    asm volatile("addiu %0,%1,%%lo(D_8006C838)"
                 : "=r"(base) : "r"(high));
    a = base + 6;
    do {
        a[0x126F + 2] = a[0x126F];
        a[0x126F + 3] = a[0x126F + 1];
        c--;
        a -= 2;
    } while (c >= 0);
    asm volatile("addiu %0,%1,%%lo(D_8006C838)"
                 : "=r"(tail) : "r"(high));
    tail[0x1271] = 0;
    tail[0x1272] = 0;
    return 1;
}
