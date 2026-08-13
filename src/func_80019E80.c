#include "common.h"
#include "psyq/stddef.h"
#include "psyq/libgte.h"
#include "psyq/libgpu.h"

s32 func_80011F5C(s32);

/* GPU primitive initializer: allocate and chain an SPRT sprite with a
 * DR_TPAGE drawing-mode primitive.  When cond == -1 the function is a
 * no-op (no texture / no sprite).  Sibling family at func_8001526C-
 * func_80015644.
 *
 * The field-write order (clut before RGB, XY0 before w/h) is load-bearing:
 * it gives the clut constant a specific local-allocation slot relative to
 * the code/RGB/w-h quantities so the target's register roles (clut in $a1,
 * w/h in $v1, hoisted tag load in $a0) fall out of the scheduler.  The
 * remaining statements use expression order that reproduces the target
 * machine stream byte-for-byte. */
void func_80019E80(u_long *ot, s16 x0, s16 y0, s16 cond) {
    s32 mask;
    SPRT *s0;
    DR_TPAGE *v0;

    if (cond != -1) {
        s0 = (SPRT *)func_80011F5C(0x14);
        v0 = (DR_TPAGE *)func_80011F5C(8);
        setSprt(s0);
        s0->clut = 0x7A80;
        setRGB0(s0, 0x80, 0x80, 0x80);
        setXY0(s0, x0, y0);
        s0->w = 0x50;
        s0->h = 0x50;
        s0->u0 = 0;
        s0->v0 = 0xAF;
        mask = 0xFFFFFF;
        s0->tag = (s0->tag & 0xFF000000) | (*ot & mask);
        *ot = (*ot & 0xFF000000) | ((u_long)s0 & mask);
        setlen(v0, 1);
        v0->code[0] = 0xE100068F;
        v0->tag = (v0->tag & 0xFF000000) | (*ot & mask);
        *ot = (*ot & 0xFF000000) | ((u_long)v0 & mask);
    }
}