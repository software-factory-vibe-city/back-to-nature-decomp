#include "common.h"

/* Three s16 fields accessed at offsets 0, 2, 4 */
typedef struct {
    s16 field_0;
    s16 field_2;
    s16 field_4;
} CoordTri;

/* Point-in-triangle test using orientation-independent cross-product signs.
 * D_8005E514 receives both the triangle's average y and its difference from
 * the bounds y value, matching the two target stores.
 *
 * POLICY EXCEPTION (user-approved 2026-07-31): the target's dead
 * `sw $v0, 0($sp)` stores an uninitialized value from hard $v0 into a stack
 * slot that is never read. Only hard-register liveness precedes local-alloc,
 * so no clean-C shape can reproduce the target's register allocation;
 * CAPTURE_PREV_RET (common.h) is the minimal construct that does, and the
 * sibling func_8001E9F8 uses the same idiom functionally. Full mechanism
 * evidence: notes/research/func_8001E878-dead-spill-allocation.md §9
 */
s32 func_8001E878(CoordTri *p0, CoordTri *p1, CoordTri *p2) {
    s32 tmp[2];
    CAPTURE_PREV_RET(phantom);
    s32 avg;
    s32 diff;
    s32 max_x;
    s32 max_y;
    s32 cross1;
    s32 cross2;
    s32 cross3;

    tmp[0] = phantom;

    avg = (p0->field_2 + p1->field_2 + p2->field_2) / 3;
    D_8005E514 = avg;
    diff = D_8005E518->field_4 - avg;
    D_8005E514 = diff;

    if (diff > D_8005E51C) {
        return 1;
    }
    if (diff < -D_8005E51C) {
        return 1;
    }

    max_x = D_8005E518->field_0;
    max_y = D_8005E518->field_8;
    D_8005E50C = max_x;
    D_8005E510 = max_y;

    cross1 = (p1->field_0 - p0->field_0) * (max_y - p0->field_4)
           - (p1->field_4 - p0->field_4) * (max_x - p0->field_0);
    D_8005E500 = cross1;
    cross2 = (p2->field_0 - p1->field_0) * (max_y - p1->field_4)
           - (p2->field_4 - p1->field_4) * (max_x - p1->field_0);
    D_8005E504 = cross2;
    cross3 = (p0->field_0 - p2->field_0) * (max_y - p2->field_4)
           - (p0->field_4 - p2->field_4) * (max_x - p2->field_0);
    D_8005E508 = cross3;

    if ((D_8005E500 <= 0 && D_8005E504 <= 0 && D_8005E508 <= 0)
     || (D_8005E500 >= 0 && D_8005E504 >= 0 && D_8005E508 >= 0)) {
        goto inside;
    }
    return 1;
inside:
    D_8005E528 = 1;
    ((s32 *)&D_80061EF8)[0] = (s32)p0;
    ((s32 *)&D_80061EF8)[1] = (s32)p1;
    ((s32 *)&D_80061EF8)[2] = (s32)p2;
    return 0;
}
