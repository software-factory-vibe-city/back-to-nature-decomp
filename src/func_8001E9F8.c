#include "common.h"

void func_8001E878(s32, s32, s32);
extern s32 D_8005E4F0;

/* POLICY EXCEPTION (user-approved 2026-07-31): file-scope register variable
 * pinned to $2/$v0. GCC never deletes stores to a global register variable
 * and reserves the register for the rest of the translation unit, which is
 * what keeps the four `move $v0,$s0` re-installs alive, keeps the
 * vertex-pool base out of $v0, and makes `hidden == 0` after each call read
 * the callee's return directly. In the original single source file this
 * declaration sat between func_8001E878 (which still uses $v0 as scratch)
 * and this function.
 *
 * Interpretation (see notes/research/func_8001E9F8.md): $2 is both the MIPS
 * return register and GCC's STATIC_CHAIN_REGNUM, but the nested-function
 * reading is DISPROVEN — no caller loads a static chain (func_8001EAE4
 * calls both functions with $v0 holding its own flags-test residue, zero on
 * every call path). The capture/save/re-install is callee-side only:
 * a register-global whose consumers were compiled out (debug channel), or a
 * misguided register-global on a call-clobbered register being manually
 * saved/restored. Its runtime value here is always the caller's zero.
 * Evidence chain: notes/research/func_8001E878-dead-spill-allocation.md §9.
 */
register s32 hidden asm("$2");

/* Point-in-quad test: decomposes a quad into point-in-triangle calls.
 * Args are four vertex indices into the pool at D_8005E4F0 (8-byte stride).
 * Degenerate quads (repeated corner index) reduce to a single triangle.
 * Returns 0 = hit, 1 = miss, read through the $v0 channel.
 *
 * The captured channel value (previous call's return) is dead-stored to
 * tmp[0] and re-forwarded into $v0 before every call — compiled-out
 * instrumentation residue, same fossil as func_8001E878's dead store.
 */
s32 func_8001E9F8(s32 i0, s32 i1, s32 i2, s32 i3) {
    s32 tmp[2];
    s32 saved;
    s32 temp_s1;
    s32 temp_s2;

    tmp[0] = hidden;
    saved = hidden;

    if ((i0 == i1) || (i0 == i2)) {
        hidden = saved;
        func_8001E878(D_8005E4F0 + (i2 * 8), D_8005E4F0 + (i1 * 8), D_8005E4F0 + (i3 * 8));
        return hidden;
    }
    if ((i3 == i1) || (i3 == i2)) {
        hidden = saved;
        func_8001E878(D_8005E4F0 + (i0 * 8), D_8005E4F0 + (i1 * 8), D_8005E4F0 + (i2 * 8));
        return hidden;
    }
    temp_s2 = i1 * 8;
    temp_s1 = i2 * 8;
    hidden = saved;
    func_8001E878(D_8005E4F0 + (i0 * 8), D_8005E4F0 + temp_s2, D_8005E4F0 + temp_s1);
    if (hidden == 0) {
        return 0;
    }
    hidden = saved;
    func_8001E878(D_8005E4F0 + (i3 * 8), D_8005E4F0 + temp_s1, D_8005E4F0 + temp_s2);
    return hidden;
}
