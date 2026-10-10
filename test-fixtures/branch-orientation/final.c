#include "common.h"
#include "psyq/stddef.h"
#include "psyq/libgte.h"

/* Maps a world position to a cell of the 7x7, 400-unit field grid (x biased
 * by 0x654, z mirrored about 0x4C4) and stores the column/row. Returns 2 when
 * the position is below the grid (the cell index is stepped down by one), 3
 * when it is past it, and otherwise 1 if the far-state mode at +0x25476 is 6
 * and the cell's entry in the 45-wide pointer table at +0x23608 has bit 3
 * clear, else 0. ovl_11_func_800D7EF8 is the 45x25 counterpart for mode 1. */
s32 ovl_11_func_8011E090(VECTOR *pos, u16 *colOut, u16 *rowOut) {
    VECTOR copy;
    u8 *base;
    u8 *p;
    u8 *tbl;
    s32 *cell;
    s32 idx;
    s16 x;
    s16 z;
    s16 col;
    s16 row;

    copy = *pos;
    *colOut = pos->vx + 0x654;
    *rowOut = 0x4C4 - pos->vz;
    z = *rowOut;
    x = *colOut;
    *colOut = (s16)*colOut / 400;
    *rowOut = (s16)*rowOut / 400;
    if (x < 0) {
        *colOut -= 1;
        return 2;
    }
    col = *colOut;
    if (col >= 7) {
        return 3;
    }
    if (z < 0) {
        *rowOut -= 1;
        return 2;
    }
    row = *rowOut;
    if (row >= 7) {
        return 3;
    }
    base = (u8 *)&D_8007AFF0;
    idx = (row * 0x2D + col) * 4;
    p = base + 0x20000;
    tbl = p + 0x3608;
    cell = *(s32 **)(tbl + idx);
    if (*(s16 *)(p + 0x5476) == 6) {
        if ((*cell & 8) == 0) {
            return 1;
        }
    } else {
        return 0;
    }
    return 0;
}
