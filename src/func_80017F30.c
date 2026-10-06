#include "common.h"

/* User-authorized matching workaround: preserve distinct raw-load v0 and
 * loop-carried t0 values. This is not evidence of original register bindings. */
s32 func_80017F30(u16 *pa, u16 *pb, u16 *pc) {
    register s32 raw asm("$2");
    register s32 x asm("$8");
    s32 y, z;
    u32 mx;
    s32 r;
    u16 sentinel = 0xFFFF;

    goto body;
top:
    if (x == sentinel) goto out;
    pa++;
    pb++;
    pc++;
body:
    raw = *pa;
    mx = raw & 0xFFFF;
    x = raw;
    y = *pb;
    if (mx == y) {
        r = 0;
        goto top;
    }
    z = *pc;
    if (mx == z) {
        r = 0;
        goto top;
    }
    r = (mx < y) ? -1 : 1;
out:
    return r;
}
