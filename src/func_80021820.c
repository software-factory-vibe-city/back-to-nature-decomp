#include "common.h"

/* Fallback voice allocator: searches voices start..end in four passes, one
 * per group 0-3 (D_8006C0C8), and returns the voice of the first group that
 * has any, choosing the one with the smallest LRU stamp (D_8006C128, whose
 * free value 0x1000000 is the search sentinel). Returns -1 when no voice in
 * the range belongs to any group.
 *
 * cc1's delay-slot pass fills the inner-loop guard with the sentinel load
 * (lui $t2, 0x100); the earlier register-pinned reconstruction left that slot
 * empty and relied on a local maspsx patch to fill it.
 */
s32 func_80021820(s32 start, s32 end) {
    s32 best;
    s32 pass;
    s32 i;
    s32 min;

    best = -1;
    for (pass = 0; pass < 4; pass++) {
        min = 0x1000000;
        for (i = start; i <= end; i++) {
            if ((&D_8006C0C8)[i] == pass && (&D_8006C128)[i] < min) {
                best = i;
                min = (&D_8006C128)[i];
            }
        }
        if (best != -1) {
            return best;
        }
    }
    return -1;
}
