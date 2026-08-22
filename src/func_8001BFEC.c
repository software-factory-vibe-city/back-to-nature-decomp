#include "common.h"

INCLUDE_ASM("build/asm/nonmatchings/func_8001BFEC", func_8001BFEC);


/* PARKED 2026-08-22, reason: one allocation priority inversion.
 * 47/58 words, residual [0, 2, 0, 5]. The population 2 is an artifact, not a
 * defect: the reversal cannot derive the word count of inline assembly from
 * the RTL and says so. What is real is that i, the hoisted 0x1F8003FC
 * constant and the element offset each land one callee-saved register out of
 * place.
 *
 * The stack switch itself is no longer a policy question: it is classified by
 * sourcePolicy.allowStackPointerSwitch — see
 * notes/research/scratchpad-stack-switch.md.
 *
 * notes/human-needed-approvals/func_8001BFEC.md has the counterfactual's
 * requirement as a number, and psx_record_closed has what has been ruled out.
 *
 * The best measured clean-C attempt is preserved verbatim below, disabled.
 */

#if 0
/* Best non-matching attempt, preserved for the next session. */
#include "common.h"

s32 D_8005E2D4;
void *D_8005E4D8;

#define PUSH_SCRATCH(slot)                                               \
    __asm__ volatile(                                                    \
        "addu $8,%0,$0" "\n\t"                                           \
        "sw $sp,0($8)" "\n\t"                                            \
        "addiu $8,$8,-4" "\n\t"                                          \
        "addu $sp,$8,$0"                                                 \
        : : "r"(slot) : "$8", "$sp")

#define POP_SCRATCH()                                                    \
    __asm__ volatile(                                                    \
        "addiu $sp,$sp,4" "\n\t"                                         \
        "lw $sp,0($sp)" : : : "$sp")

void func_8001BFEC(void **arg0) {
    s32 i;
    s32 r_off;
    unsigned int *slot;

    D_8005E4D8 = *arg0;
    PushMatrix();
    if (D_8005E2D4 != 0) {
        PUSH_SCRATCH((unsigned int *)0x1F8003FC);
        func_8001D6B8();
        POP_SCRATCH();
    }
    if (*(s32 *)((char *)D_8005E4D8 + 8) > 0) {
        i = 0;
        slot = (unsigned int *)0x1F8003FC;
        r_off = 0xC;
        do {
            PUSH_SCRATCH(slot);
            func_8001C37C((char *)D_8005E4D8 + 0xC, (char *)D_8005E4D8 + r_off);
            POP_SCRATCH();
            r_off += 0x1C;
        } while (++i < *(s32 *)((char *)D_8005E4D8 + 8));
    }
    PopMatrix();
}
#endif
