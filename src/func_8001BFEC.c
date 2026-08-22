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
#include "scratchpad.h"

s32 D_8005E2D4;
void *D_8005E4D8;

void func_8001BFEC(void **arg0) {
    s32 i;
    s32 r_off;
    u_long *slot;

    D_8005E4D8 = *arg0;
    PushMatrix();
    if (D_8005E2D4 != 0) {
        SCRATCH_STACK_BEGIN(SCRATCH_STACK_SLOT);
        func_8001D6B8();
        SCRATCH_STACK_END();
    }
    if (*(s32 *)((char *)D_8005E4D8 + 8) > 0) {
        i = 0;
        slot = SCRATCH_STACK_SLOT;
        r_off = 0xC;
        do {
            SCRATCH_STACK_BEGIN(slot);
            func_8001C37C((char *)D_8005E4D8 + 0xC, (char *)D_8005E4D8 + r_off);
            SCRATCH_STACK_END();
            r_off += 0x1C;
        } while (++i < *(s32 *)((char *)D_8005E4D8 + 8));
    }
    PopMatrix();
}
#endif
