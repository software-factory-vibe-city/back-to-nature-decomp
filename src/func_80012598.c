#include "common.h"

extern unsigned long *ClearOTagR(unsigned long *ot, int n);

/* TU-owned globals (GP-relative in the target) */
s32 D_8005E3B0;
s32 D_8005E3B8;
s32 D_8005E3BC;

/*
 * func_80012598 -- graphics heap carve + double-buffer / ordering-table init.
 *
 * MATCHED. `make check` is green and `psx_diff_function --bytes` reports
 * byte-identical in the linked binary at the original address.
 *
 * POLICY EXCEPTION -- hard-register pinning and embedded asm, granted
 * explicitly by the user on 2026-08-11 (AGENTS.md defers the clean-source
 * policy to explicit user instruction). Allowlisted in .pi/autodecomp.json.
 *
 * This is tracked debt, not a claim about the original source. The original was
 * certainly plain C: the constructs below are forcing devices for register
 * allocation and instruction order, standing in for one mechanism the
 * reconstruction could not reproduce from C. That mechanism is now known and
 * written down -- see notes/research/func_80012598.md section 3.1: the target's
 * sixteen base-address copies are reload rematerialisations with
 * one-instruction live ranges (`lreg` holds 4 reg-to-reg sets, `greg` 18), so
 * they cost the original nothing, while every copy a C reconstruction creates
 * holds a register. Peak simultaneous base-equal webs is 12 in the target;
 * clean-C attempts sat at 13-14 and traded one copy per register, which is why
 * the best clean-C state stalled at 55 differing words. Anyone who finds a
 * single-set, per-view-distinct C spelling of those copies should delete every
 * `register ... asm` and `__asm__` below and the allowlist entry with them.
 *
 * WHAT THE FUNCTION DOES
 *
 * D_8005E5E8[2] is the double-buffered render context, stride 0x134
 * (see include/globals_override.h). Field map, from the store set plus the
 * sibling users:
 *
 *   0x000  DRAWENV draw      func_80011370 calls SetDefDrawEnv on +0x000/+0x134
 *   0x016  draw.dtd/dfe/isbg = 1, draw.r0/g0/b0 = 0    (the six sb)
 *   0x05C  DISPENV disp      func_80011370: SetDefDispEnv on +0x05C/+0x190
 *   0x084  GsOT ot[4]        libgs GsOT is exactly 0x14 bytes
 *                            (length/org/offset/point/tag);
 *                            tag == org + ((1 << length) - 1)
 *   0x0D8  GsOT_TAG *org[4]  = { p0, p1, p2, NULL }
 *   0x0EC  u_long   n[4]     = { 0x40, 0x10, 2, 0 }     (n == 1 << bits)
 *   0x100  u_long   bits[4]  = { 6, 4, 1, 0 }
 *   0x110  big OT: length 0x800 (== 1 << 0xB), bits 0xB
 *   0x118  prim cursor, 0x11C prim length 0x17700,
 *          0x120 OT base, 0x124 prim base      (all four also written by the
 *                                               matched sibling func_8001E160)
 *   0x128  work-area length 0x5EDC, 0x12C work-area base
 *          (func_800120C8: GsSetWorkBase(...->field_12C))
 *   0x130  VRAM staging base (func_800128DC memcpy target)
 *
 * Every pool is carved out of the single 0x3EE50-byte block at 0x801BE1B0 that
 * the leading memset clears; 0x33090 + 2*0x5EDC == 0x3EE48, so the carve ends
 * exactly at the end of that block:
 *   +0x00000  p0  OT tags, 0x40 entries per buffer   (cursor stride 0x100)
 *   +0x00200  p1  OT tags, 0x10 entries per buffer   (cursor stride 0x040)
 *   +0x00280  p2  OT tags, 2 entries per buffer      (cursor stride 0x008)
 *   +0x00290  big OT, 0x800 entries per buffer       (cursor stride 0x2000)
 *   +0x04290  primitive buffers, 0x17700 each
 *   +0x33090  work areas, 0x5EDC each
 *
 * Loop 2 is the same source as the matched sibling func_8001E160 and is plain
 * C: it rewrites 0x110/0x114/0x120, adds 0x11C/0x124/0x118, and clears both
 * primitive buffers. Keep the two in the same shape -- writing it with
 * decomposed address temporaries instead of E160's single expressions commutes
 * two `addu` operands.
 *
 * NAMING: rV0/rV1/rA0/rA1/rA3/rT0..rT6 are the target's own register roles for
 * the struct base address. The target multiplexes each register over two or
 * three sequential roles (`$v0` alternates between holding the base and being
 * scratch for `li`), which is why they read as registers rather than as
 * variables; s0..s7/t7..t9 are the loop-carried pool cursors and constants.
 */

#define COPY(d, s) __asm__ volatile("addu %0, %1, $zero" : "=r"(d) : "r"(s))
#define P(x) ((s32 *)(x))

void func_80012598(void) {
    register u8 *s0 asm("$16");
    register u8 *s1 asm("$17");
    register s32 s2 asm("$18");
    register s32 s3 asm("$19");
    register s32 s4 asm("$20");
    register s32 s5 asm("$21");
    register s32 s6 asm("$22");
    register s32 s7 asm("$23");
    register s32 t7 asm("$15");
    register s32 t8 asm("$24");
    register s32 t9 asm("$25");
    register s32 rV0 asm("$2");
    register s32 rV1 asm("$3");
    register s32 *rA0 asm("$4");
    register s32 *rA1 asm("$5");
    register s32 temp_a2 asm("$6");
    register s32 *rA3 asm("$7");
    s32 * rT0;
    s32 * rT1;
    s32 * rT2;
    s32 * rT3;
    s32 * rT4;
    s32 * rT5;
    register s32 *rT6 asm("$14");
    s32 s8;
    s32 sp10;
    s32 i;
    s32 j;
    s32 temp_s3;

    s7 = 0x801BE1B0;
    D_8005E3B0 = s7;
    memset((void *)0x801BE1B0, 0, 0x3EE50);
    rV1 = 0x801FCFF8;
    s5 = 1;
    __asm__("" : "=r"(s5) : "0"(s5));
    s4 = 0x801C2440;
    __asm__ volatile("lui %0, %%hi(D_8005E5E8)" : "=r"(rV0));
    __asm__ volatile("addiu %0, %1, %%lo(D_8005E5E8)" : "=r"(s0) : "r"(rV0));
    s1 = s0;
    s3 = 0x801BE440;
    t9 = 0x801BE430;
    t8 = 0x801BE3B0;
    s2 = 0x801BE1B0;
    t7 = 0;
    s6 = 0x17700;
    s8 = 1;
    sp10 = 0;
    __asm__("" : : "m"(sp10));
    D_8005E3BC = rV1;
    D_8005E3B8 = rV1;

    do {
        temp_a2 = 0x33090;
        rA1 = P(s0 + 0xD8);
        rA1 = P(t7 + (s32)rA1);
        __asm__("" : "=r"(rA1) : "0"(rA1));
        rA0 = P((u8 *)s0 + t7);
        rV0 = 0x40;
        rA3 = P(s0 + 0xDC);
        rA3 = P(t7 + (s32)rA3);
        rT6 = P(s0 + 0xE0);
        rT6 = P(t7 + (s32)rT6);
        rV1 = sp10;
        __asm__ volatile("addiu %0, %0, -1" : "+r"(s8));
        temp_a2 = rV1 + temp_a2;
        rV1 += 0x5EDC;
        sp10 = rV1;

        COPY(rV1, rA0);
        *rA1 = s2;
        rA0[0x3B] = rV0;
        rV0 = 6;
        P(rV1)[0x40] = rV0;
        rV0 = 0x10;
        *rA3 = t8;
        rA0[0x3C] = rV0;
        rV0 = 4;
        P(rV1)[0x41] = rV0;
        rV0 = 2;
        *rT6 = t9;
        rA0[0x3D] = rV0;

        rV0 = rV1;
        P(rV1)[0x42] = s5;
        P(rV0)[0x39] = 0;
        P(rV1)[0x3E] = 0;
        P(rV0)[0x43] = 0;
        rV0 = 0x800;
        P(rV1)[0x44] = rV0;
        rV0 = 0xB;
        rA0[0x45] = rV0;
        P(rV1)[0x48] = s3;
        s3 += 0x2000;
        t9 += 8;
        t8 += 0x40;
        s2 += 0x100;

        rV0 = rV1;
        rV1 = 6;
        s1[0x16] = (u8)s5;
        s1[0x17] = (u8)s5;
        s1[0x18] = (u8)s5;
        s1[0x19] = 0;
        s1[0x1A] = 0;
        s1[0x1B] = 0;
        P(rV0)[0x21] = rV1;

        rV1 = rV0;
        COPY(rT0, rV0);
        COPY(rT1, rV0);
        COPY(rT2, rV0);
        COPY(rT3, rV0);
        COPY(rT4, rV0);
        COPY(rT5, rV0);
        P(rV1)[0x24] = 0;
        P(rV0)[0x23] = 0;

        rA0 = P(*rA1);
        temp_a2 = s7 + temp_a2;
        P(rV0)[0x22] = (s32)rA0;
        rV1 = *rA1;
        COPY(rA0, rV0);
        rV1 += 0xFC;
        rA0[0x25] = rV1;
        rV1 = 4;
        P(rV0)[0x26] = rV1;

        COPY(rV1, rV0);
        P(rV1)[0x29] = 0;
        P(rV0)[0x28] = 0;
        rA0 = P(*rA3);
        COPY(rA1, rV0);
        P(rV0)[0x27] = (s32)rA0;
        rV1 = *rA3;
        COPY(rA0, rV0);
        rV1 += 0x3C;
        rA0[0x2A] = rV1;

        COPY(rV1, rV0);
        P(rV0)[0x2B] = s5;
        P(rV1)[0x2E] = 0;
        P(rV0)[0x2D] = 0;
        rV1 = *rT6;
        rA3 = rV0;
        rA0[0x2C] = rV1;
        rV0 = *rT6;
        t7 += 0x134;
        rV0 += 4;
        rA1[0x2F] = rV0;
        rV0 = 0x5EDC;
        rA3[0x30] = 0;
        rT0[0x33] = 0;
        rT1[0x32] = 0;
        rT2[0x31] = 0;
        rT3[0x34] = 0;
        rT4[0x4A] = rV0;
        rT5[0x4B] = temp_a2;
        *(s32 *)(s1 + 0x130) = s4;
        s4 += s6;
        s1 += 0x134;
    } while (s8 >= 0);

    temp_s3 = D_8005E3B0;
    j = 0;
    s2 = 0x176FF;
    do {
        s32 *base2;
        base2 = (s32 *)((u8 *)&D_8005E5E8 + (j * 0x134));
        base2[0x44] = 0x800;
        base2[0x45] = 0xB;
        base2[0x48] = temp_s3 + 0x290 + (j << 13);
        base2[0x47] = 0x17700;
        base2[0x49] = temp_s3 + 0x4290 + (j * 0x17700);
        ClearOTagR((unsigned long *)base2[0x48], 0x800);
        i = 0;
        do {
            ((u8 *)base2[0x49])[i] = 0;
            i++;
        } while (i <= s2);
        base2[0x46] = base2[0x49];
        j++;
    } while (j < 2);
}
