#include "common.h"
#include "psyq/stddef.h"
#include "psyq/libgte.h"
#include "psyq/libgpu.h"

LINE_F2 *func_8001530C(LINE_F2 *p, u_long *ot, s16 x0, s16 y0,
                       s16 x1, s16 y1, s32 color, s16 cond) {
    s32 code;
    u8 r0, g0, b0;

    setLineF2(p);
    if (cond != 0) {
        code = 0x42;
        setcode(p, code);
    } else {
        code = 0x40;
        setcode(p, code);
    }
    r0 = (u8)(color >> 16);
    g0 = (u8)(color >> 8);
    b0 = (u8)color;
    setXY0(p, x0, y0);
    p->x1 = x1;
    p->y1 = y1;
    p->r0 = r0;
    p->g0 = g0;
    p->b0 = b0;
    addPrim(ot, p);
    return p + 1;
}
