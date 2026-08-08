/* Research, evidence, and falsified hypotheses:
 * notes/research/func_80016C08-tu-owned-globals-and-gp-relative-addressing.md
 */

#include "common.h"
#include "globals_override.h"
#include "psyq/stddef.h"
#include "psyq/libgte.h"
#include "psyq/libgpu.h"

/* Sprite entry loop driver: walks the entry list of one sprite frame and
 * emits a POLY_FT4 per entry, accumulating texture upload sizes through
 * func_80016B7C.
 *
 * MATCHING (byte-verified), with two tracked debts recorded in
 * notes/research/func_80016C08-tu-owned-globals-and-gp-relative-addressing.md:
 *
 * 1. CC1FLAGS_func_80016C08 := -mno-split-addresses (configs/flag_overrides.mk,
 *    owner-approved). Without it the loop-tail D_8005E3C0 load compiles as
 *    lui $v0 / lw $v1,lo($v0): GCSE PRE hoists HIGH(D_8005E3C0) out of the
 *    loop, reload rematerializes it into an independent spill register, and
 *    sched2 advances it above the two link stores. The target instead has the
 *    one-register self-clobbering pair lui $v1 / lw $v1,lo($v1) after the
 *    stores, which only arises when the assembler expands an unsplit load.
 *
 * 2. The redundant `found = nclut;` at the top of the entry loop. Tracked
 *    debt, not a semantic statement: under the override, reload assigns spill
 *    slots in ascending pseudo-register order, and GCSE PRE allocates those
 *    pseudo numbers in expression-hash-table iteration order. Without the
 *    extra store the clutList base gets the highest number and slot 88
 *    instead of the target's 72 (rotating all five spill slots). The extra
 *    pre-GCSE store restores the target's reaching-register numbering and
 *    hence the target slot layout (clutList 72, ent-12 76, i-1 80, poly+0x28
 *    84, flags&0x18 88). Verified by the variant run in
 *    build/fuzz/func_80016C08/4ba081e1a0b45a7e (p1/p2/p3 all restore the
 *    layout; only the displacements change).
 */

u16 D_8005E438;

s32 func_80016B7C(s32 *arg0, s32 arg1, s32 arg2, s32 arg3, s32 arg4); /* extern */

/* {count, byte offset} pair used to locate a sub-table (4 bytes) */
typedef struct {
    /* 0x00 */ s16 unk0;
    /* 0x02 */ u16 unk2;
} SpriteRef;

/* texture/cel rectangle record (8 bytes) */
typedef struct {
    /* 0x00 */ s16 unk0;
    /* 0x02 */ s16 unk2;
    /* 0x04 */ s16 unk4;
    /* 0x06 */ s16 unk6;
} SpriteTex;

/* one drawn piece of a frame (12 bytes) */
typedef struct {
    /* 0x00 */ u16 unk0;
    /* 0x02 */ u16 unk2;
    /* 0x04 */ u16 unk4;
    /* 0x06 */ u16 unk6;
    /* 0x08 */ u8  unk8;
    /* 0x09 */ u8  unk9;
    /* 0x0A */ u16 unkA;
} SpriteEntry;

/* one animation frame header (10 bytes) */
typedef struct {
    /* 0x00 */ u16 unk0;
    /* 0x02 */ u16 unk2;
    /* 0x04 */ u16 unk4;
    /* 0x06 */ u16 unk6;
    /* 0x08 */ u16 unk8;
} SpriteFrame;

/* sprite instance / data block (0x30) */
typedef struct {
    /* 0x00 */ u16 unk0;
    /* 0x02 */ u16 unk2;
    /* 0x04 */ u8  unk4;
    /* 0x05 */ u8  unk5;
    /* 0x06 */ u16 unk6;
    /* 0x08 */ u8  pad8[0x14];
    /* 0x1C */ SpriteTex *unk1C;
    /* 0x20 */ SpriteRef *unk20;
    /* 0x24 */ u8 *unk24;
    /* 0x28 */ SpriteRef *unk28;
    /* 0x2C */ u8 *unk2C;
} SpriteSourceData;

POLY_FT4* func_80016C08(s32 *ot, POLY_FT4 *poly, SpriteSourceData *src,
                        s16 ox, s16 oy, u16 flags, s32 total, s32 texBase,
                        s16 subst, s16 substFrom, s16 substTo) {
    s16 clutList[12];
    SpriteFrame *frame;
    SpriteEntry *ent;
    SpriteTex *cel;
    SpriteTex *tex;
    s32 count;
    s32 nclut;
    s32 found;
    s32 size;
    s32 key;
    s32 tp;
    s32 rot;
    s32 i;
    s32 j;
    s32 fill;
    s32 last;
    s16 tx;
    s16 ty;
    s16 u;
    s16 v;
    s16 w;
    s16 h;
    s16 x0;
    s16 y0;
    s16 x1;
    s16 y1;
    s32 xbase;
    s32 ybase;

    frame = (SpriteFrame *) (src->unk2C + src->unk28[src->unk4].unk2) + src->unk5;
    if (frame->unk0 < 0xFFFE) {
        nclut = 0;
        for (fill = 0; fill < 10; fill++) {
            clutList[fill] = -1;
        }
        ent = (SpriteEntry *) (src->unk24 + src->unk20[frame->unk0].unk2);
        count = src->unk20[frame->unk0].unk0;
        ent += count - 1;
        last = count - 1;
        i = last;
        for (; i >= 0; i--, ent--) {
            size = 0;
            /* Tracked debt: this redundant store only shifts GCSE
             * pseudo-register numbering so reload assigns the target's spill
             * slot layout; see the file header comment. Do not remove
             * without re-checking the 72/76/80/84/88 slot map. */
            found = nclut;
            found = 0;
            cel = &src->unk1C[ent->unk0];
            tex = &((SpriteTex *) texBase)[ent->unk9 - 0x80];
            key = ent->unk9 - 0x80;
            for (j = 0; j < 10; j++) {
                if (clutList[j] == key) {
                    found = 1;
                    break;
                }
            }
            if (found == 0) {
                clutList[nclut++] = ent->unk9 - 0x80;
                size = func_80016B7C((s32 *) src, ent->unk0, total, tex->unk4, tex->unk6);
                D_8005E438 = ent->unk2;
                if (subst != -1) {
                    if (ent->unk9 == 0x80) {
                        D_8005E438 = subst;
                    }
                    if (ent->unk2 == substFrom) {
                        D_8005E438 = substTo;
                    }
                }
                size += func_80016B7C((s32 *) src, (s16) D_8005E438, total + size,
                                      tex->unk0, tex->unk2);
            }
            setPolyFT4(poly);
            setSemiTrans(poly, (ent->unk8 >> 4) & 1);
            setRGB0(poly, 0x80, 0x80, 0x80);
            setShadeTex(poly, 0);
            setClut(poly, tex->unk0, tex->unk2);
            tx = tex->unk4;
            ty = tex->unk6;
            u = tx & 0x3F;
            tp = ent->unk8 >> 7;
            rot = ent->unk8 & 3;
            setTPage(poly, tp, 0, tx, ty);
            w = cel->unk4;
            if (tp == 0) {
                u *= 4;
                w *= 4;
            } else {
                u *= 2;
                w *= 2;
            }
            v = ty & 0xFF;
            h = cel->unk6;
            if (rot == 0) {
                setUV4(poly, u, v, u + (w - 1), v, u, v + (h - 1), u + (w - 1), v + (h - 1));
            } else if (rot == 1) {
                setUV4(poly, u + (w - 1), v, u, v, u + (w - 1), v + (h - 1), u, v + (h - 1));
            } else if (rot == 2) {
                setUV4(poly, u, v + (h - 1), u + (w - 1), v + (h - 1), u, v, u + (w - 1), v);
            } else {
                setUV4(poly, u + (w - 1), v + (h - 1), u, v + (h - 1), u + (w - 1), v, u, v);
            }
            xbase = ox + frame->unk2;
            x0 = xbase + ent->unk4;
            x1 = x0 + w;
            ybase = oy + frame->unk4;
            y0 = ybase + ent->unk6;
            y1 = y0 + h;
            if (flags & 0x18) {
                setXY4(poly, x1, y1, x0, y1, x1, y0, x0, y0);
            } else if (flags & 8) {
                setXY4(poly, x1, y0, x0, y0, x1, y1, x0, y1);
            } else if (flags & 0x10) {
                setXY4(poly, x0, y1, x1, y1, x0, y0, x1, y0);
            } else {
                setXY4(poly, x0, y0, x1, y0, x0, y1, x1, y1);
            }
            poly->tag = (*ot & 0xFFFFFF) | 0x09000000;
            *ot = (s32) poly & 0xFFFFFF;
            total += size;
            poly++;
            D_8005E3C0->field_118 += 0x28;
        }
    }
    return poly;
}
