#include "common.h"
#include "include_asm.h"

/* func_80016C08 — sprite entry loop driver (sprite-renderer family,
 * notes/file-groupings.md). Walks the entry list of one animation frame,
 * emits a POLY_FT4 per entry, accumulates texture upload sizes through two
 * func_80016B7C calls, and prepends each primitive to an ordering table.
 *
 * STATUS: reverted to assembly on 2026-08-03. The C reconstruction below
 * reached 355/357 (LCS-aligned); it is preserved under `#if 0` and is NOT a
 * dead end — it is correct as far as it goes. Every instruction except the
 * two-instruction D_8005E3C0 address materialization at the loop tail is
 * exact, and all 211 register webs match.
 *
 * WHY IT IS NOT MATCHED YET
 * The target materializes the global with one register:
 *     lui $v1,%hi(D_8005E3C0) ; lw $v1,%lo(D_8005E3C0)($v1)
 * Our build uses two. This is decided in local-alloc, not in the C. The
 * address value is a loop invariant with no register operands, so GCSE PRE
 * always moves it to the loop preheader; it then gets no hard register and
 * reload rematerializes it, and reload never selects the destination
 * register of the load. Verified against the real Sony CC1PSX.EXE: it
 * produces the same code from this source, so neither the compiler build
 * nor the source spelling is at fault.
 *
 * FULL EVIDENCE, INCLUDING NINE FALSIFIED HYPOTHESES:
 *   notes/research/func_80016C08-tu-owned-globals-and-gp-relative-addressing.md
 * Read section 11 (assumption audit) before spending any effort here.
 *
 * NEXT IMMEDIATE STEPS, IN ORDER
 *  1. Decompile func_800165D8 first. It is the witness: same file group,
 *     same D_8005E3C0 `+= 0x28` tail, and it DOES compile to the
 *     one-register form — because there the update sits inside one arm of
 *     an if/else inside the loop, so PRE cannot hoist the address value.
 *     Matching it recovers the source idiom we are missing here.
 *  2. Apply that idiom to this function. The standing suspect assumption is
 *     that this loop tail is unconditional in the original source.
 *  3. If step 2 does not close it, satisfy the allocator requirement
 *     directly (research note section 10): the address value must stay in
 *     the loop, and the field-value quantity must be allocated before it so
 *     that $v0 is already taken. Priority is
 *     floor_log2(refs) * refs * size / (death - birth); lengthening the
 *     address value's live range lowers its priority below the field
 *     value's.
 *  4. Do NOT re-run these: per-file -mno-split-addresses (falsified by
 *     func_80016054 in the same file), -fno-gcse, -fno-schedule-insns,
 *     -fno-schedule-insns2, tail statement reordering, or small inline-asm
 *     wrappers. All are recorded as measured failures in the note.
 *
 * NOTE ON D_8005E438: the reconstruction below carries a tentative
 * definition of that global, which is required for the gp-relative access
 * ASPSX emits only for in-file declarations. It is inert while this
 * function is assembly (the extracted .sdata already defines the symbol),
 * but it must come back with the C. See the research note, section 3.
 */

INCLUDE_ASM("build/asm/nonmatchings/func_80016C08", func_80016C08);

#if 0
/* ---------------------------------------------------------------------- *
 * Preserved reconstruction — 355/357 (LCS-aligned), 357/357 instructions,
 * 211/211 register webs. Restore this verbatim when step 1 or 2 above
 * yields the missing idiom.
 * ---------------------------------------------------------------------- */

#include "common.h"
#include "globals_override.h"
#include "psyq/stddef.h"
#include "psyq/libgte.h"
#include "psyq/libgpu.h"

/* Sprite entry loop driver: walks the entry list of one sprite frame and
 * emits a POLY_FT4 per entry, accumulating texture upload sizes through
 * func_80016B7C.
 *
 * NON-MATCHING: 353/357 indexed (355/357 LCS-aligned). The remaining
 * scheduling mismatch is the D_8005E3C0 address materialization at the loop
 * tail: the target stores both links before a self-clobbering $v1 lui/lw,
 * while cc1 reloads the hoisted HIGH through $v0 and sched2 advances it.
 * Reconstruction history, the required ASPSX gp-relative rule, and the
 * compiler-state experiments are in
 * notes/research/func_80016C08-tu-owned-globals-and-gp-relative-addressing.md
 */

/* Owned by this translation unit. The target reaches this global
 * gp-relatively, and ASPSX emits gp-relative accesses only for symbols the
 * file itself declares; an external reference always expands through $at
 * (measured against ASPSX 2.77 — see the research note above, section 3).
 * The tentative definition makes cc1 emit .comm, which the linker resolves
 * against the extracted .sdata definition at 0x8005E438. This requires
 * --use-comm-section in MASPSX_FLAGS, or maspsx allocates a private .sbss. */
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

POLY_FT4 *func_80016C08(s32 *ot, POLY_FT4 *poly, SpriteSourceData *src,
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

#endif
