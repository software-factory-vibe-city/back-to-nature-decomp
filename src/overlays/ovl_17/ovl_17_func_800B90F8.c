#include "common.h"

INCLUDE_ASM("build/ovl_17/asm/nonmatchings/ovl_17_func_800B90F8", ovl_17_func_800B90F8);


/* PARKED by /auto_decompilation_loop on 2026-10-04T08:33:39.490Z.
 * Reason: escalation-exhausted.
 * Escalation reached: deepseek-v4-1-flash.
 * The best non-matching attempt is preserved verbatim below, disabled.
 * Findings and the decision needed: notes/human-needed-approvals/ovl_17_func_800B90F8.md
 */

#if 0
/* Best non-matching attempt, preserved for the next session. */
#include "common.h"

void ovl_17_func_800B90F8(void) {
    u8 *base;
    s32 i;
    s32 val;
    s32 x;
    s32 word;
    s32 minus1;

    i = 0;
    word = -0x20000;
    minus1 = -1;
    x = 0x10000;
    val = 0x4D;
    base = D_800BD848;
    do {
        *(s32 *)(base + 0x2D8) = word;
        *(s16 *)(base + 0x2DC) = minus1;
        if (i < 6) {
            *(s16 *)(base + 0x2DC) = val;
        }
        i = x;
        x += 0x10000;
        val += 0x1A;
        i >>= 16;
        base += 8;
    } while (i < 90);
    base = D_800BD848;
    *(s16 *)(base + 0x5A8) = 6;
}
#endif
