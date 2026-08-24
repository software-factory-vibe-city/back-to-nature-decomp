#include "common.h"

INCLUDE_ASM("build/ovl_11/asm/nonmatchings/ovl_11_func_80108B8C", ovl_11_func_80108B8C);


/* PARKED by /auto_decompilation_loop on 2026-08-24T20:09:46.896Z.
 * Reason: escalation-exhausted.
 * Escalation reached: deepseek-v4-flash.
 * The best non-matching attempt is preserved verbatim below, disabled.
 * Findings and the decision needed: notes/human-needed-approvals/ovl_11_func_80108B8C.md
 */

#if 0
/* Best non-matching attempt, preserved for the next session. */
#include "common.h"

typedef struct {
    /* 0x00 */ s16 field_0;
    /* 0x02 */ s16 field_2;
} Ovl11D050Entry;

extern Ovl11D050Entry D_8012D050[3];

void ovl_11_func_80108B8C(void) {
    s16 y;
    int d;
    u8 *base;

    y = D_8012D050[2].field_2;
    if (y == 2) {
        d = D_8012D050[2].field_0 - 0x258;
        if ((unsigned)d < 9U) {
            /* Two-stage base formation keeps +0xE7A2 as runtime ori/addu (matched idiom) */
            base = (u8 *)&D_8006C838;
            base += 0xE7A2;
            base += d;
            if (*base == 1) {
                *base = y;
            }
        }
    }
}
#endif
