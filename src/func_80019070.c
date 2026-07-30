#include "common.h"
#include "psyq/stddef.h"
#include "psyq/libgte.h"
#include "psyq/libgpu.h"

/* Builds a sprite followed by its drawing-mode primitive.
 *
 * NON-MATCHING WORK IN PROGRESS — current best structural reconstruction.
 * The raw byte cursor + typed per-primitive locals (not a packet struct)
 * produce the coalescible pointer copies the scheduler requires; with this
 * shape all 81 target instructions exist with correct operands, and the
 * staging variables below reach the target's exact registers (v0/v1/a1).
 * Remaining diffs and open questions are annotated inline; the full
 * investigation record is in plans/ and
 * build/residualSourceSearch/func_80019070/.
 */
void *func_80019070(s32 *ordering_table, u8 *packet, u32 glyph,
                    s32 x, s16 y, u8 red, u8 green, u8 blue,
                    u32 palette, s32 semitransparent)
{
    u32 texture_u;
    s16 sprite_x;
    u32 palette_index;
    u32 clut_index; /* staging: 0x64 now, CLUT address later; multi-set ->
                       unboosted, allocated v1 like the target. */
    u8 len;         /* UNKNOWN #1: the 4 must reach v0 (block-local: works)
                       AND lose its scheduler birth boost (proven necessary).
                       Plain `len = 4` is single-set -> boosted -> schedules
                       at slot 5 instead of the target's slot 1. Condition
                       reuse, constructed constants, and tail second-sets are
                       all empirically eliminated; suspect a sub-word
                       (strict_low_part) assignment shape or an unseen
                       macro/header form. */
    u8 code;
    SPRT *sprt;
    DR_TPAGE *tpage;

    sprt = (SPRT *)packet;
    len = 4; /* <-- UNKNOWN #1 sits on this statement */
    clut_index = 0x64;
    glyph = (u16)glyph;
    texture_u = glyph & 0xF;
    glyph &= 0xF0;
    palette_index = palette;
    setlen(sprt, len);
    setcode(sprt, clut_index);
    sprite_x = (s16)x;
    /* UNKNOWN #2: the barriers are reconstruction scaffolding — the original
       had none, yet achieved the same window separation naturally (removal
       currently scores worse). Possibly a consequence of UNKNOWN #1. */
    __asm__ volatile("" ::: "memory");
    glyph >>= 4;

    if (palette_index >= 6) {
        palette_index = 0;
    }

    /* The CLUT address accumulates through the staging variable itself,
       matching the target's sll v1 / addu v1 / lhu 0(v1) sequence. */
    clut_index = palette_index << 1;
    clut_index += (u32)D_80049044;
    setClut(sprt, 0x380, *(u16 *)clut_index);
    setRGB0(sprt, red, green, blue);
    /* Keep the RGB stores ahead of the CLUT/code scheduling window. */
    __asm__ volatile("" ::: "memory");

    code = 0x64;
    if (semitransparent != 0) {
        code = 0x66;
    }

    setcode(sprt, code);
    /* Keep mask and UV setup out of the semitransparency branch window. */
    __asm__ volatile("" ::: "memory");
    setXY0(sprt, sprite_x, y);
    setUV0(sprt, texture_u * 8, (glyph * 3) << 2);
    setWH(sprt, 8, 12);
    addPrim(ordering_table, sprt);
    /* UNKNOWN #3: with this source the ordering-table copy colors t2; the
       target has t3, one t-slot later, cascading through sra/lw/lh. Some
       early t-register consumer is missing — plausibly UNKNOWN #1 again. */

    packet += sizeof(SPRT);
    tpage = (DR_TPAGE *)packet;
    setDrawTPage(tpage, 1, 1, 0xE);
    addPrim(ordering_table, tpage);

    return packet + sizeof(DR_TPAGE);
}
