#include "common.h"
#include "psyq/stddef.h"
#include "psyq/libgte.h"
#include "psyq/libgpu.h"

/* TILE_1 primitive initializer (PSY-Q helper family; siblings at
 * func_8001530C (LINE_F2), func_800153BC (POLY_G4), func_800154CC (POLY_F4),
 * func_80015594 (TILE)).  Sets len/code, RGB, the semitransparent code
 * variant, the vertex coordinates, links the primitive into the ordering
 * table, and returns the next primitive slot.
 */
TILE_1 *func_8001526C(TILE_1 *p, u_long *ot, s16 x0, s16 y0, s32 color, s16 cond) {
    s32 code;

    setlen(p, 2);
    setcode(p, 0x68);
    if (cond != 0) {
        code = 0x6A;
        setcode(p, code);
    } else {
        code = 0x68;
        setcode(p, code);
    }
    setXY0(p, x0, y0);
    setRGB0(p, (u8)(color >> 16), (u8)(color >> 8), (u8)color);
    addPrim(ot, p);
    return p + 1;
}
