#include "common.h"
#include "include_asm.h"

INCLUDE_ASM("build/asm/nonmatchings/func_8001BFEC", func_8001BFEC);


/* PARKED by /auto_decompilation_loop on 2026-08-22T08:04:22.637Z.
 * Reason: asm-needs-human-approval.
 * Escalation reached: deepseek-v4-flash.
 * The best non-matching attempt is preserved verbatim below, disabled.
 * Findings and the decision needed: notes/human-needed-approvals/func_8001BFEC.md
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
    register s32 i asm("$16");
    register s32 r_off asm("$18");
    register unsigned int *slot asm("$17");
    unsigned int *slot0;

    D_8005E4D8 = *arg0;
    PushMatrix();
    if (D_8005E2D4 != 0) {
        slot0 = (unsigned int *)0x1F8003FC;
        PUSH_SCRATCH(slot0);
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
