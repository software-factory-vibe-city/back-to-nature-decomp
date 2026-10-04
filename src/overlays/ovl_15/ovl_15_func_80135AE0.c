#include "common.h"

INCLUDE_ASM("build/ovl_15/asm/nonmatchings/ovl_15_func_80135AE0", ovl_15_func_80135AE0);


/* PARKED by /auto_decompilation_loop on 2026-10-04T15:46:52.960Z.
 * Reason: escalation-exhausted.
 * Escalation reached: deepseek-v4-1-flash.
 * The best non-matching attempt is preserved verbatim below, disabled.
 * Findings and the decision needed: notes/human-needed-approvals/ovl_15_func_80135AE0.md
 */

#if 0
/* Best non-matching attempt, preserved for the next session. */
#include "common.h"

typedef struct {
    u8 data[0x7F];
    u8 sum;
} Blk;

void ovl_15_func_80135AE0(void) {
    u8 sum;
    u8 c;
    s32 i;
    s32 j;
    s32 off;
    u8 *q;

    sum = 0;
    off = 0x280;
    for (i = 0; i < 251; i++) {
        c = 0;
        for (j = 0; j < 127; j++) {
            c ^= D_80137830[off + j];
        }
        ((Blk *)(D_80137830 + off))->sum = c;
        sum ^= c;
        off += 0x80;
    }
    i = off + 0x80;
    D_80137A30[0x38] = sum;
    c = 0;
    q = D_80137A30;
    for (i = 0; i < 127; i++) {
        c ^= *q++;
    }
    D_80137830[0x27F] = c;
}
#endif
