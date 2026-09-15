#include "common.h"

INCLUDE_ASM("build/ovl_11/asm/nonmatchings/ovl_11_func_8010476C", ovl_11_func_8010476C);


/* PARKED by /auto_decompilation_loop on 2026-09-15T10:56:14.474Z.
 * Reason: escalation-exhausted.
 * Escalation reached: glm-5-3-flash.
 * The best non-matching attempt is preserved verbatim below, disabled.
 * Findings and the decision needed: notes/human-needed-approvals/ovl_11_func_8010476C.md
 */

#if 0
/* Best non-matching attempt, preserved for the next session. */
#include "common.h"

/* Clear the card table: three rows of six 14-byte card records. Each record's
 * value halfword is marked empty (-1) and the remaining six halfwords are
 * zeroed, matching the deal layout used by func_8002206C. */
void ovl_11_func_8010476C(void) {
    s16 *pW;
    s16 *pX;
    s16 *pBase;
    s16 *base2;
    u32 rows;
    u32 n;
    u32 next;
    u32 rb;

    rows = 0;
    pBase = (s16 *)&D_80074838;
    base2 = (s16 *)&D_8006C838;
    base2 += 0x7291;
    do {
        next = rows + 1;
        pX = (s16 *)(rows * 0x54 + (u32)base2);
        rb = rows * 0x54 + 0x6520;
        pW = (s16 *)(rb + (u32)pBase);
        do {
            pW[-5] = -1;
            pW[-4] = 0;
            pW[-3] = 0;
            pW[-2] = 0;
            pW[-1] = 0;
            pW[0] = 0;
            *pX = 0;
            pX += 7;
            pW += 7;
            n++;
        } while (n < 6U);
        rows = next;
        n = 0;
    } while (rows < 3U);
}
#endif
