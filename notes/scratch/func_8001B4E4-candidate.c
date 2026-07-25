/* De-superstition sweep candidate for func_8001B4E4 — NOT matching (order 100%
 * correct; single allocation tie-break remains: sp web gets v1, addrD0 gets v0,
 * target has them swapped).
 *
 * 2026-07-25 SOLVED: src/func_8001B4E4.c now matches 19/19 in clean C
 * (never re-assign arg0; inline (arg0 << 1) at each s16 store). See retro
 * C4 update. This file is kept only as a record of the dead-end shape.
 *
 * 2026-07-25 UPDATE (see retro C4 update): this shape is a proven dead end.
 * sp dies 3 times, so REG_N_DEATHS != 1 pushes it to global-alloc, which
 * deterministically loses v0 — no source perturbation of THIS structure can
 * flip it. The original must have used single-death pseudos plus a different
 * scheduler-pinning dependency. The correct allocation cascade for a
 * single-set structure is worked out in the retro note.
 *
 * Mechanisms discovered:
 *  - Reusing ONE pointer variable creates WAR/WAW dependencies that pin the
 *    scheduler: this is why the target's shifts/stores stay in RTL order.
 *  - sp must carry: struct ptr -> shift result -> addr32 -> addrC4.
 *  - addrC0 likely reuses arg0's register (target: addu a0,a0,v0).
 * Next: perturb pseudo numbering/allocation priority, or run the diff
 * classifier + STRONGER_AGENT on this candidate as starting point. */
#include "common.h"

extern s32 D_8005E4C8;
extern s16 D_8005E4C4;
extern s16 D_8005E4D0;
extern s16 D_8005E4C0;

void func_8001B4E4(s32 arg0) {
    struct_8005E870 *sp;
    s16 *addrD0;
    s16 *addrC0;

    sp = &D_8005E870;
    sp->field_36 = 0;
    sp->field_37 = 0;
    sp = (struct_8005E870 *)(arg0 << 2);
    sp = (struct_8005E870 *)((char *)&D_8005E4C8 + (s32)sp);
    arg0 <<= 1;
    *(s32 *)sp = 0;
    sp = (struct_8005E870 *)((char *)&D_8005E4C4 + arg0);
    addrD0 = (s16 *)((char *)&D_8005E4D0 + arg0);
    *(s16 *)sp = 0;
    addrC0 = (s16 *)((char *)&D_8005E4C0 + arg0);
    *addrD0 = 0;
    *addrC0 = 0;
}
