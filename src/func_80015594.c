#include "common.h"
#include "psyq/stddef.h"
#include "psyq/libgte.h"
#include "psyq/libgpu.h"

/*
 * Initialize and link a TILE primitive, returning the next packet slot.
 * The shared code variable lets crossjump merge the branch-local code stores.
 * Keeping setXY0 after the join preserves the signed coordinate conversions.
 */
TILE *func_80015594(TILE *p, u_long *ot, s16 x0, s16 y0,
                    s16 w, s16 h, s32 color, s16 cond) {
    s32 code;

    setTile(p);
    setRGB0(p, (u8)(color >> 16), (u8)(color >> 8), (u8)color);
    if (cond != 0) {
        code = 0x62;
        setcode(p, code);
    } else {
        code = 0x60;
        setcode(p, code);
    }
    setXY0(p, x0, y0);
    setWH(p, w, h);
    addPrim(ot, p);
    return p + 1;
}
