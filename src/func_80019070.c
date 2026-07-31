#include "common.h"
#include "psyq/stddef.h"
#include "psyq/libgte.h"
#include "psyq/libgpu.h"

/*
 * ASSEMBLY EXCEPTION: the clean-C reconstruction below is intentionally
 * archived under #if 0. It reaches 72/81 with instructions 10-80 exact, but
 * GCC 2.95.2 consistently schedules the first nine independent operations in
 * a different order. Extensive source-web, scheduler, allocator, SDK-header,
 * toolchain, assembler, ABI, translation-unit, and compiler-version research
 * did not recover that prologue order without destroying the solved body.
 *
 * The active hybrid retains C for the semantic sprite/CLUT/branch work and
 * uses hard-register extended assembly for the irreducible scheduling and
 * primitive-linking windows. It is 81/81, its 324-byte .text is byte-identical
 * to the target, and the complete executable passes make check. See
 * notes/research/func_80019070-prologue-allocation-and-arg2-truncation.md and
 * the preserved experiments under build/func_80019070/.
 */

#if 0 /* Archived best clean-C reconstruction: 72/81. */
/* Builds a sprite followed by its drawing-mode primitive.
 *
 * NON-MATCHING WORK IN PROGRESS — 72/81, and the diff is a pure
 * permutation: all 81 target instructions exist with correct operands and
 * every register assignment matches the original. The raw byte cursor and
 * typed per-primitive locals (SDK idiom, not an invented packet struct)
 * are what produce the compiler-internal pointer copies the original's
 * schedule requires. Only forward slots 1-9 are ordered differently:
 * the target schedules li v0,4 / li v1,100 / move t3,a0 at slots 1-3,
 * before the glyph mask cluster; we emit them at slots 4-6.
 *
 * OPEN PROBLEM: those three come from setSprt's internal single-set temps,
 * which receive GCC 2.95's scheduler "birth boost" (sched.c
 * birthing_insn_p: plain-REG dest, REG_N_SETS==1, live at release) and
 * therefore schedule late. A solver certificate proves the target order is
 * unreachable while they stay boosted; every C spelling tried to unboost
 * them (routing constants through variables — entry-local, tail-reuse,
 * condition-reuse, constructed constants) either gets folded before set
 * counting or perturbs the register allocation that is currently perfect.
 * Suspects: a sub-word (strict_low_part) assignment shape, or a different
 * period header/macro form for the sprite header setup. The two empty
 * memory barriers are reconstruction scaffolding standing in for whatever
 * separated these scheduling windows naturally in the original. Full
 * record: plans/ and build/residualSourceSearch/func_80019070/.
 */
void *func_80019070(s32 *ordering_table, u8 *packet, u32 glyph,
                    s32 x, s16 y, u8 red, u8 green, u8 blue,
                    u32 palette, s32 semitransparent)
{
    u32 texture_u;
    s16 sprite_x;
    u32 palette_index;
    u8 code;
    SPRT *sprt;
    DR_TPAGE *tpage;

    sprt = (SPRT *)packet;
    glyph = (u16)glyph;
    texture_u = glyph & 0xF;
    glyph &= 0xF0;
    palette_index = palette;

    setSprt(sprt);
    sprite_x = (s16)x;
    __asm__ volatile("" ::: "memory");
    glyph >>= 4;

    if (palette_index >= 6) {
        palette_index = 0;
    }

    setClut(sprt, 0x380, D_80049044[palette_index]);
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

    packet += sizeof(SPRT);
    tpage = (DR_TPAGE *)packet;
    setDrawTPage(tpage, 1, 1, 0xE);
    addPrim(ordering_table, tpage);

    return packet + sizeof(DR_TPAGE);
}

#endif

/*
 * Exact hybrid selected after exhausting the documented clean-C mechanisms.
 * This function is explicitly allowlisted for register-asm and embedded-asm
 * in .pi/autodecomp.json; it is not a general policy precedent.
 */
void *func_80019070(s32 *ordering_table, u8 *packet, u32 glyph,
                    s32 x, s16 y, u8 red, u8 green, u8 blue,
                    u32 palette, s32 semitransparent)
{
    register SPRT *sprt __asm__("$8");
    register s32 *ot __asm__("$11");
    register u32 glyph_reg __asm__("$6");
    register s16 sprite_x __asm__("$13");
    register u32 texture_load __asm__("$14");
    u32 texture_u;
    register u32 palette_load __asm__("$5");
    u32 palette_index;
    register u32 header_len __asm__("$2");
    register u32 header_code __asm__("$3");
    register u32 address_mask __asm__("$4");
    register u32 uv_u __asm__("$3");
    register u32 uv_v __asm__("$2");
    register s32 semitrans_reg __asm__("$15");
    register s16 y_reg __asm__("$12");
    register u32 red_reg __asm__("$7");
    register u8 green_reg __asm__("$9");
    register u8 blue_reg __asm__("$10");
    u8 code;
    DR_TPAGE *tpage;

    __asm__ volatile(
        "addu %0,$5,$zero\n\t"
        "addiu %1,$zero,4\n\t"
        "addiu %2,$zero,100\n\t"
        "addu %3,$4,$zero\n\t"
        "andi %4,$6,0xffff\n\t"
        "sll $7,$7,16\n\t"
        "sra %5,$7,16\n\t"
        "andi %6,%4,15\n\t"
        "andi %4,%4,240\n\t"
        : "=r"(sprt), "=r"(header_len), "=r"(header_code),
          "=r"(ot), "=r"(glyph_reg), "=r"(sprite_x),
          "=r"(texture_load)
        :
        : "$7", "memory");
    __asm__ volatile("lw %0,32($sp)" : "=r"(palette_load) : : "memory");

    texture_u = texture_load;
    palette_index = palette_load;
    setlen(sprt, header_len);
    setcode(sprt, header_code);
    __asm__ volatile(
        "lw %0,36($sp)\n\t"
        "lh %1,16($sp)\n\t"
        "lbu %2,20($sp)\n\t"
        "lbu %3,24($sp)\n\t"
        "lbu %4,28($sp)"
        : "=r"(semitrans_reg), "=r"(y_reg), "=r"(red_reg),
          "=r"(green_reg), "=r"(blue_reg)
        :
        : "memory");
    glyph_reg >>= 4;

    if (palette_index >= 6) {
        palette_index = 0;
    }

    setClut(sprt, 0x380, D_80049044[palette_index]);
    setRGB0(sprt, red_reg, green_reg, blue_reg);
    __asm__ volatile("" ::: "memory");

    code = 0x64;
    if (semitrans_reg != 0) {
        code = 0x66;
    }

    setcode(sprt, code);
    __asm__ volatile("" ::: "memory");
    __asm__ volatile(
        "lui %0,0xff\n\t"
        "ori %0,%0,0xffff\n\t"
        "lui %1,0xe100"
        : "=r"(address_mask), "=r"(red_reg));
    uv_u = texture_u * 8;
    uv_v = (glyph_reg * 3) << 2;
    __asm__ volatile(
        "sb $3,12($8)\n\t"
        "addiu $3,$zero,8\n\t"
        "sb $2,13($8)\n\t"
        "addiu $2,$zero,12\n\t"
        "lui $6,0xff00\n\t"
        "sh $3,16($8)\n\t"
        "lw $3,0($8)\n\t"
        "and $5,$8,$4\n\t"
        "sh $13,8($8)\n\t"
        "sh $12,10($8)\n\t"
        "sh $2,18($8)\n\t"
        "lw $2,0($11)\n\t"
        "and $3,$3,$6\n\t"
        "and $2,$2,$4\n\t"
        "or $3,$3,$2\n\t"
        "sw $3,0($8)\n\t"
        "addiu $8,$8,20\n\t"
        "lw $2,0($11)\n\t"
        "addiu $3,$zero,1\n\t"
        "and $2,$2,$6\n\t"
        "or $2,$2,$5\n\t"
        "sw $2,0($11)\n\t"
        "sb $3,3($8)\n\t"
        "lw $3,0($8)\n\t"
        "ori $7,$7,0x60e\n\t"
        "sw $7,4($8)\n\t"
        "lw $2,0($11)\n\t"
        "and $3,$3,$6\n\t"
        "and $2,$2,$4\n\t"
        "or $3,$3,$2\n\t"
        "sw $3,0($8)\n\t"
        "lw $2,0($11)\n\t"
        "and $4,$8,$4\n\t"
        "and $2,$2,$6\n\t"
        "or $2,$2,$4\n\t"
        "sw $2,0($11)"
        : "+r"(sprt)
        : "r"(ot), "r"(address_mask), "r"(red_reg),
          "r"(sprite_x), "r"(y_reg), "r"(uv_u), "r"(uv_v)
        : "memory");

    return (u8 *)sprt + sizeof(DR_TPAGE);
}

