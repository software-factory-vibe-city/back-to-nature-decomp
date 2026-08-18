#include "common.h"
#include "include_asm.h"

INCLUDE_ASM("build/asm/nonmatchings/func_8001231C", func_8001231C);

/*
 * func_8001231C — PARKED 2026-08-11 with a ready playbook. Not yet attempted.
 *
 * Do NOT start from psx_m2c or from a fresh reading of the disassembly.
 * This function is a near-verbatim clone of func_80012598 (matched 2026-08-11):
 * same 0x40 frame, same graphics-heap carve, and a first loop whose 21 register
 * webs and store partition are identical. Copy src/func_80012598.c and apply
 * six deltas.
 *
 * Full recipe, with the register-rotation table, the verification commands, the
 * trap list and the stop rule: notes/research/func_8001231C.md
 * Underlying mechanism and measurements: notes/research/func_80012598.md
 *
 * The six deltas, in brief:
 *   1. D_8005E3BC / D_8005E3B8 take 0x801F7000, not 0x801FCFF8.
 *   2. The work-area stride is 0x2EE0, not 0x5EDC (both the spilled accumulator
 *      increment and the length stored to 0x128). 0x33090 is unchanged.
 *   3. The second phase is a call, not an inlined loop: `func_8001E160();`
 *      — declare it `void func_8001E160(void)`; it is already matched.
 *   4. Rotate the register pins: &D_8005E5E8 is $t8 (not $s0), the byte pointer
 *      is $t9 (not $s1), and the p0/p1/p2 pool cursors are $s0/$s1/$s2 (not
 *      $s2/$t8/$t9). Everything else keeps its register.
 *   5. The base is `addu $a0, $t8, $t7` — base register first, as in the parent.
 *   6. The symbol load is the same split `lui %hi` / `addiu %lo` pair the parent
 *      needs hand-written; change only the output register.
 *
 * Two things that will waste a session if ignored:
 *   - `diffFunc --src` is not the verdict here. It reported
 *     "MISMATCH — 0 word(s) differ" on func_80012598 while the linked binary
 *     differed in 25 words; `0 differing` with `same < total` means displacement.
 *     Use `--bytes` or `make check`.
 *   - The target's base-address copies are reload rematerialisations, not CSE
 *     artifacts (lreg 4 reg-to-reg sets -> greg 18). Do not try to create them
 *     from source pointer variables; that consumed two sessions on the parent.
 */


/* PARKED by /auto_decompilation_loop on 2026-08-18T00:50:45.314Z.
 * Reason: asm-needs-human-approval.
 * Escalation reached: deepseek-v4-flash.
 * The best non-matching attempt is preserved verbatim below, disabled.
 * Findings and the decision needed: notes/human-needed-approvals/func_8001231C.md
 */

#if 0
/* Best non-matching attempt, preserved for the next session. */
#include "common.h"

/* TU-owned globals (GP-relative in the target) */
s32 D_8005E3B0;
s32 D_8005E3B8;
s32 D_8005E3BC;

/*
 * func_8001231C -- graphics heap carve + double-buffer / ordering-table init.
 *
 * Near-verbatim clone of func_80012598 (matched 2026-08-11): same 0x40 frame,
 * same memset(0x801BE1B0, 0, 0x3EE50), and a first loop whose 21 register webs
 * and store partition are identical. Six deltas:
 *   1. D_8005E3BC/D_8005E3B8 = 0x801F7000, not 0x801FCFF8.
 *   2. work-area stride 0x2EE0, not 0x5EDC (spill increment + 0x128 length).
 *   3. second phase is a call to func_8001E160, not an inlined loop.
 *   4. register rotation: &D_8005E5E8 in $t8, byte pointer in $t9, pool
 *      cursors p0/p1/p2 in $s0/$s1/$s2 (see recipe for the full table).
 *   5. base is addu $a0, $t8, $t7 -- base register first.
 *   6. symbol load is the lui %hi / addiu %lo pair into $t8, then t9 = t8.
 *
 * POLICY: same register-asm / embedded-asm constructs as func_80012598 -- the
 * target's base-address copies are reload rematerialisations with
 * one-instruction live ranges. Two forcing devices beyond the twin's:
 *   - block 1 routes the spilled work-area accumulator through $v0 (rV0),
 *     hoists COPY(rV1, rA0) next to the base, and births the 0x40 constant
 *     after the accumulator's last use -- the mirror image of the twin's
 *     ordering, which the plain statement swap cannot reproduce because the
 *     accumulator's register choice is an allocation decision.
 *   - block 0 materialises memset's a0/a2 into $4/$6 via non-volatile asm so
 *     the call's own expansion only births `move a1,0`, which then fills the
 *     jal-delay slot (sched2/dbr otherwise put `ori a2` there). Non-volatile,
 *     not volatile: the pairs must stay schedulable to sit ahead of the
 *     callee-save store block as in the target. GCC folds any C spelling of
 *     this (heap-size local, register vars) back into the call.
 * Allowlist entry is filed only once this matches
 * (see notes/research/func_8001231C.md).
 */

#define COPY(d, s) __asm__ volatile("addu %0, %1, $zero" : "=r"(d) : "r"(s))
#define P(x) ((s32 *)(x))

void func_8001231C(void) {
    register u8 *t8 asm("$24");
    register u8 *t9 asm("$25");
    register s32 s0 asm("$16");
    register s32 s1 asm("$17");
    register s32 s2 asm("$18");
    register s32 s3 asm("$19");
    register s32 s4 asm("$20");
    register s32 s5 asm("$21");
    register s32 s6 asm("$22");
    register s32 s7 asm("$23");
    register s32 t7 asm("$15");
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

    s7 = 0x801BE1B0;
    __asm__("lui %0, 0x801B" : "=r"(rA0));
    __asm__("ori %0, %0, 0xE1B0" : "+r"(rA0));
    __asm__("lui %0, 0x3" : "=r"(temp_a2));
    __asm__("ori %0, %0, 0xEE50" : "+r"(temp_a2));
    D_8005E3B0 = s7;
    memset((void *)rA0, 0, temp_a2);
    rV1 = 0x801F7000;
    s5 = 1;
    __asm__("" : "=r"(s5) : "0"(s5));
    s4 = 0x801C2440;
    __asm__ volatile("lui %0, %%hi(D_8005E5E8)" : "=r"(rV0));
    __asm__ volatile("addiu %0, %1, %%lo(D_8005E5E8)" : "=r"(t8) : "r"(rV0));
    t9 = t8;
    s3 = 0x801BE440;
    s2 = 0x801BE430;
    s1 = 0x801BE3B0;
    s0 = 0x801BE1B0;
    t7 = 0;
    s6 = 0x17700;
    s8 = 1;
    sp10 = 0;
    __asm__("" : : "m"(sp10));
    D_8005E3BC = rV1;
    D_8005E3B8 = rV1;

    do {
        temp_a2 = 0x33090;
        rA1 = P(t8 + 0xD8);
        rA1 = P(t7 + (s32)rA1);
        __asm__("" : "=r"(rA1) : "0"(rA1));
        rA0 = P((u8 *)t8 + t7);
        COPY(rV1, rA0);
        rA3 = P(t8 + 0xDC);
        rA3 = P(t7 + (s32)rA3);
        rT6 = P(t8 + 0xE0);
        rT6 = P(t7 + (s32)rT6);
        rV0 = sp10;
        __asm__ volatile("addiu %0, %0, -1" : "+r"(s8));
        temp_a2 = rV0 + temp_a2;
        rV0 += 0x2EE0;
        sp10 = rV0;

        rV0 = 0x40;
        *rA1 = s0;
        rA0[0x3B] = rV0;
        rV0 = 6;
        P(rV1)[0x40] = rV0;
        rV0 = 0x10;
        *rA3 = s1;
        rA0[0x3C] = rV0;
        rV0 = 4;
        P(rV1)[0x41] = rV0;
        rV0 = 2;
        *rT6 = s2;
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
        s2 += 8;
        s1 += 0x40;
        s0 += 0x100;

        rV0 = rV1;
        rV1 = 6;
        t9[0x16] = (u8)s5;
        t9[0x17] = (u8)s5;
        t9[0x18] = (u8)s5;
        t9[0x19] = 0;
        t9[0x1A] = 0;
        t9[0x1B] = 0;
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
        rV0 = 0x2EE0;
        rA3[0x30] = 0;
        rT0[0x33] = 0;
        rT1[0x32] = 0;
        rT2[0x31] = 0;
        rT3[0x34] = 0;
        rT4[0x4A] = rV0;
        rT5[0x4B] = temp_a2;
        *(s32 *)(t9 + 0x130) = s4;
        s4 += s6;
        t9 += 0x134;
    } while (s8 >= 0);

    func_8001E160();
}
#endif
