/* De-superstition sweep candidate for func_8001E7DC — NOT matching.
 * Mechanism discovered: the target's entire shape follows from the loaded
 * value (a0_val) being allocated to $a0, which clobbers arg0's register and
 * forces the `move a2,a0` pointer copy + per-load addiu increments.
 * Without pins, GCC eliminates the a2 copy via copy-propagation and uses
 * indexed loads (lw v1,4(a0)) instead. Need: a source structure that makes
 * the load-result pseudo prefer $a0 (or makes the pointer copy un-propagatable).
 * Also note: the "672(gp) vs 684(gp)" artifact in diffFunc output is a
 * LINK-level artifact (unmatched function shifts _gp-relative offsets),
 * not a source bug. */
#include "common.h"

extern s32 D_8005E520;

s32 func_8001E7DC(s32 *arg0, s32 *arg1) {
    s32 *a2;
    s32 a0_val;
    s32 a3;
    s32 t0;
    s32 v1;
    s32 v0;

    a2 = arg0;

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
    return 0;
check_y:
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
