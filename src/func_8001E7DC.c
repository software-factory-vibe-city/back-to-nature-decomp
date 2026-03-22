#include "common.h"

extern s32 D_8005E520;

s32 func_8001E7DC(s32 *arg0, s32 *arg1) {
    /* register __asm__ required: compiler uses t0 for arg0 copy, target uses a2;
       uses t1 for loaded temp, target uses a0 */
    register s32 *a2 __asm__("a2");
    register s32 a0_val __asm__("a0");
    s32 a3;
    s32 t0;
    s32 v1;
    s32 v0;

    a2 = arg0;
    __asm__ volatile("" : "=r"(a2) : "0"(a2));

    a0_val = arg1[0];
    arg1++;
    v1 = a2[0];
    v1 = v1 - a0_val;
    a3 = (D_8005E520 >> 1) + 0x258;
    t0 = -a3;
    a2++;
    if (v1 < t0) {
        goto fail;
    }
    if (!(a3 < v1)) {
        goto check_y;
    }
fail:
    __asm__ volatile("_8001E818:");
    return 0;
check_y:
    __asm__ volatile("_8001E820:");
    a0_val = arg1[0];
    arg1++;
    v1 = a2[0];
    v1 = v1 - a0_val;
    a2++;
    if (v1 < t0) {
        goto fail;
    }
    if (a3 < v1) {
        goto fail;
    }
    v0 = a2[0];
    __asm__ volatile("" : "=r"(v0) : "0"(v0));
    v1 = arg1[0];
    v1 = v0 - v1;
    a0_val = (v1 < t0);
    if (a0_val) {
        goto fail;
    }
    if (a3 < v1) {
        goto fail;
    }
    return 1;
}
