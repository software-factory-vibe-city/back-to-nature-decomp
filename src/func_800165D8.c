#include "common.h"
#include "include_asm.h"

/* func_800165D8 — larger direct-primitive renderer (sprite-renderer family,
 * notes/file-groupings.md). Called by func_80015E78, func_80015F80,
 * func_80016054, func_800160C8, and func_800161AC.
 *
 * STATUS: parked as assembly. The reconstruction below is preserved verbatim
 * under `#if 0` and reaches 206/360 instructions at object level (154
 * differences). It is kept for its structure, not its score: the overall shape
 * corresponds to the target, but the first divergence is already in the
 * prologue (`sw s3,20(sp)` against `sw s1,12(sp)`), so callee-save assignment
 * and frame layout differ before any body statement runs.
 *
 * WHY THIS FUNCTION MATTERS BEYOND ITSELF
 * Its target is the one place in this file group where the D_8005E3C0 address
 * materializes into a single register, which is the defect blocking
 * func_80016C08. Decompiling this function is step 1 of that function's
 * roadmap. Direction and evidence live in:
 *   notes/research/func_80016C08-tu-owned-globals-and-gp-relative-addressing.md
 * Section 16 states what its target proves; section 16 step 1 records the
 * scope measured here.
 *
 * Its own frame and callee-save problem is separate from the address form and
 * should not be conflated with it.
 */

INCLUDE_ASM("build/asm/nonmatchings/func_800165D8", func_800165D8);

#if 0
/* ---------------------------------------------------------------------- *
 * Preserved reconstruction — 206/360 instructions at object level.
 * Restore this verbatim when the address form and the prologue are settled.
 * ---------------------------------------------------------------------- */

#include "common.h"
#include "psyq/stddef.h"
#include "psyq/libgte.h"
#include "psyq/libgpu.h"

typedef struct {
    s16 field_00;
    u16 field_02;
} Group;

typedef struct {
    u16 field_00;
    s16 field_02;
    s16 field_04;
    s16 field_06;
    s16 field_08;
} Header;

typedef struct {
    u16 field_00;
    u16 field_02;
    s16 field_04;
    s16 field_06;
    u8 field_08;
    u8 pad_09;
    u16 pad_0A;
} Entry;

typedef struct {
    s16 field_00;
    s16 field_02;
    s16 field_04;
    s16 field_06;
} Vertex;

typedef struct {
    u16 field_00;
    u16 field_02;
    u16 field_04;
    u16 field_06;
    u16 field_08;
    u16 field_0A;
    s16 field_0C;
    s16 field_0E;
    s16 field_10;
    s16 field_12;
    u32 pad_14;
    u32 pad_18;
    Vertex *field_1C;
    Group *field_20;
    u8 *field_24;
    Group *field_28;
    u8 *field_2C;
    s32 field_30;
} SourceData;

POLY_FT4 *func_800165D8(u_long *arg0, POLY_FT4 *arg1, SourceData *arg2, u8 arg3,
                        u8 arg4, s16 arg5, s16 arg6, s32 arg7, s32 arg8, s32 arg9,
                        u16 arg10, s16 arg11, s16 arg12, s16 arg13, s16 arg14) {
    POLY_FT4 *p;
    Header *hdr;
    Group *grp;
    Entry *ent;
    Vertex *uv0;
    Vertex *uv1;
    s32 clutX;
    s32 clutY;
    s16 tpageX;
    s16 tpageY;
    s16 u;
    s16 v;
    s16 w;
    s16 h;
    s32 sx;
    s32 sy;
    s32 tp;
    s32 flip;
    s32 xBase;
    s32 xFar;
    s32 yBase;
    s32 yFar;
    s16 x0;
    s16 x1;
    s16 y0;
    s16 y1;
    s16 i;
    s16 count;

    p = arg1;
    hdr = (Header *)(arg2->field_2C + arg2->field_28[arg3].field_02) + arg4;
    if (hdr->field_00 >= 0xFFFE) {
        return p;
    }

    grp = &arg2->field_20[hdr->field_00];
    count = grp->field_00;
    ent = (Entry *)(arg2->field_24 + grp->field_02) + (count - 1);
    i = count - 1;
    while (i >= 0) {
        uv0 = &arg2->field_1C[ent->field_00];
        uv1 = &arg2->field_1C[ent->field_02];
        setPolyFT4(p);
        setSemiTrans(p, (arg2->field_02 & 0x20) || ((ent->field_08 >> 4) & 1));
        setShadeTex(p, 0);
        setRGB0(p, 0x80, 0x80, 0x80);

        if (arg13 == -1) {
            clutX = uv1->field_00 + arg2->field_10;
            clutY = uv1->field_02 + arg2->field_12;
        } else {
            clutX = arg13;
            clutY = arg14;
        }
        p->clut = getClut(clutX, clutY);

        tp = ent->field_08 >> 7;
        flip = ent->field_08 & 3;
        if (arg11 == -1) {
            sx = uv0->field_00 + arg2->field_0C;
            sy = uv0->field_02 + arg2->field_0E;
            tpageX = sx & ~0x3F;
            tpageY = sy & ~0xFF;
            u = sx & 0x3F;
            v = sy & 0xFF;
        } else {
            tpageX = arg11;
            tpageY = arg12;
            u = arg11;
            v = arg12;
        }
        p->tpage = getTPage(tp, 0, tpageX, tpageY);

        u = u & 0x3F;
        v = v & 0xFF;
        w = uv0->field_04;
        h = uv0->field_06;
        if (tp == 0) {
            u *= 4;
            w *= 4;
        } else {
            u *= 2;
            w *= 2;
        }

        if (flip == 0) {
            p->u0 = u;
            p->v0 = v;
            p->u1 = u + (w - 1);
            p->v1 = v;
            p->u2 = u;
            p->v2 = v + (h - 1);
            p->u3 = u + (w - 1);
            p->v3 = v + (h - 1);
        } else if (flip == 1) {
            p->u0 = u + (w - 1);
            p->v0 = v;
            p->u1 = u;
            p->v1 = v;
            p->u2 = u + (w - 1);
            p->v2 = v + (h - 1);
            p->u3 = u;
            p->v3 = v + (h - 1);
        } else if (flip == 2) {
            p->u0 = u;
            p->v0 = v + (h - 1);
            p->u1 = u + (w - 1);
            p->v1 = v + (h - 1);
            p->u2 = u;
            p->v2 = v;
            p->u3 = u + (w - 1);
            p->v3 = v;
        } else {
            p->u0 = u + (w - 1);
            p->v0 = v + (h - 1);
            p->u1 = u;
            p->v1 = v + (h - 1);
            p->u2 = u + (w - 1);
            p->v2 = v;
            p->u3 = u;
            p->v3 = v;
        }

        if (arg9 == 0) {
            xBase = hdr->field_02 + ent->field_04;
            xFar = xBase + w;
            yBase = hdr->field_04 + ent->field_06;
            yFar = yBase + h;
            if (arg7 + arg8 != 0x2000) {
                x0 = arg5 + ((xBase * arg7) / 4096);
                x1 = arg5 + ((xFar * arg7) / 4096);
                y0 = arg6 + ((yBase * arg8) / 4096);
                y1 = arg6 + ((yFar * arg8) / 4096);
            } else {
                x0 = arg5 + xBase;
                x1 = arg5 + xFar;
                y0 = arg6 + yBase;
                y1 = arg6 + yFar;
            }
            if (arg10 & 0x18) {
                p->x0 = x1;
                p->y0 = y1;
                p->x1 = x0;
                p->y1 = y1;
                p->x2 = x1;
                p->y2 = y0;
                p->x3 = x0;
                p->y3 = y0;
            } else if (arg10 & 8) {
                p->x0 = x1;
                p->y0 = y0;
                p->x1 = x0;
                p->y1 = y0;
                p->x2 = x1;
                p->y2 = y1;
                p->x3 = x0;
                p->y3 = y1;
            } else if (arg10 & 0x10) {
                p->x0 = x0;
                p->y0 = y1;
                p->x1 = x1;
                p->y1 = y1;
                p->x2 = x0;
                p->y2 = y0;
                p->x3 = x1;
                p->y3 = y0;
            } else {
                p->x0 = x0;
                p->y0 = y0;
                p->x1 = x1;
                p->y1 = y0;
                p->x2 = x0;
                p->y2 = y1;
                p->x3 = x1;
                p->y3 = y1;
            }
        }

        if (arg10 & 0x40) {
            p->tag = 0x09000000 | getaddr(arg0);
            *arg0 = (u_long)p & 0xFFFFFF;
            D_8005E3C0->field_118 += 0x28;
        } else {
            addPrim(arg0, p);
        }
        p++;
        ent--;
        i--;
    }
    return p;
}

#endif
