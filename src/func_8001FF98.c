/*
 * func_8001FF98 - sound engine reset.
 *
 * Clears the 6-slot song/request state (parallel per-song tables, -1 = empty
 * sentinel), the [6][1] score tables (libsnd SsSetTableSize idiom: [s_max]
 * [t_max] with t_max == 1 for SEQ-only), the request-FIFO cursors, and the
 * 24-entry SPU voice-allocation table (0x01000000 = min-scan sentinel used
 * by the 4-pass voice allocator in func_80021820).
 *
 * Matches byte-identically under the standard project flags. Two details are
 * load-bearing:
 *  - The [6][1] type of D_8006C088/D_8006C0A8 (globals_override.h): the
 *    nested one-iteration init loop must survive as a real loop.
 *  - Reusing `row` as the tail-loop counter: the tail's `row + 1` is a
 *    post-loop second occurrence of the outer increment expression, which
 *    ISOLATES it in gcse's PRE (redundant = antloc & ~(latein | isoout)) and
 *    keeps it at the loop bottom where loop.c needs it. A separate tail
 *    counter reopens the loop-PRE hoist and unmatches the function. See
 *    notes/research/func_8001FF98-gcse-pre-blocks-loop-strength-reduction.md.
 */

#include "common.h"

s32 D_8005E540;
s32 D_8005E550;
s32 D_8005E554;
s32 D_8005E560;

void func_8001FF98(void) {
    s32 row;
    s32 col;
    s32 val;
    s32 *p1;
    s32 *p2;

    D_8005E540 = 0;
    D_8005E554 = 0;
    for (row = 0; row < 6; row++) {
        (&D_8006BF48)[row] = -1;
        (&D_8006BF68)[row] = 0;
        (&D_8006BF88)[row] = 0;
        (&D_8006BFA8)[row] = -1;
        (&D_8006BFC8)[row] = -1;
        (&D_8006C028)[row] = -1;
        (&D_8006BFE8)[row] = -1;
        (&D_8006C008)[row] = -1;
        (&D_8006C068)[row] = -1;
        (&D_8006C048)[row] = -1;
        for (col = 0; col < 1; col++) {
            D_8006C088[row][col] = -1;
            D_8006C0A8[row][col] = -1;
        }
    }
    val = 0x01000000;
    D_8005E550 = 0;
    D_8005E560 = 0;
    p1 = &D_8006C128;
    p2 = &D_8006C0C8;
    for (row = 0; row < 24; row++) {
        *p1++ = val;
        *p2++ = 0;
    }
}
