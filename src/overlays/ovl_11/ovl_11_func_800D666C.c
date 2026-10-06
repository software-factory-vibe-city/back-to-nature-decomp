#include "common.h"
#include "game_types.h"
#include "psyq/memory.h"

s32 ovl_11_func_800D5750(s16 arg0);

/*
 * Clear the record matching arg0 from the row selected by ovl_11_func_800D5750.
 *
 * D_800A0494 is a 32-row x 9-s16 grid (row stride 0x12) and D_800A04B8 is the
 * 0x1E-byte-record view 0x24 above it. Classify arg0 to a row, walk the row's 9
 * halfwords, and on a match zero the slot and fill the paired record with 0xFF.
 *
 * The byte offset is built in the order the original emitted it: scale the row
 * index, add it back, then double for bytes. `far_base`/`tbl` keep the far
 * buffer base and the +0x254A4 row base as separate runtime values so the
 * symbol offset is not folded into the load.
 */
void ovl_11_func_800D666C(s16 arg0) {
    char *far_base;
    char *tbl;
    s32 off;
    s16 *var_a0;
    s32 var_a1;
    u32 var_a2;
    Ovl11A04B8Entry *var_v1;

    if (arg0 != 0) {
        var_a1 = ovl_11_func_800D5750(arg0);
        var_a2 = 0;
        if (var_a1 == 2) {
            var_a1 = 1;
        }
        off = var_a1 * 8;
        far_base = (char *)&D_8007AFF0;
        off = off + var_a1;
        off = off * 2;
        tbl = far_base + 0x254A4;
        var_a0 = (s16 *)(tbl + off);
        var_v1 = &D_800A04B8[var_a1][0];
        do {
            var_a2 += 1;
            if (*var_a0 == arg0) {
                *var_a0 = 0;
                memset(var_v1, 0xFF, 0x1E);
                return;
            }
            var_v1++;
            var_a0 += 1;
        } while (var_a2 < 9);
    }
}
