#include "common.h"

INCLUDE_ASM("build/ovl_11/asm/nonmatchings/ovl_11_func_80112D10", ovl_11_func_80112D10);


/* PARKED by /auto_decompilation_loop on 2026-09-15T14:08:46.375Z.
 * Reason: escalation-exhausted.
 * Escalation reached: glm-5-3-flash.
 * The best non-matching attempt is preserved verbatim below, disabled.
 * Findings and the decision needed: notes/human-needed-approvals/ovl_11_func_80112D10.md
 */

#if 0
/* Best non-matching attempt, preserved for the next session. */
#include "common.h"

extern u8 D_8012D110[];

void ovl_11_func_80112D10(void) {
    u8 *b;
    u8 *p;
    s32 idx;
    u32 i;
    u32 j;
    u32 k;

    i = 0;
    b = D_8012D110;
    p = b + 0xC;
    while (i < 10) {
        p[i] = 0;
        for (j = 0; j < 10; j++) {
            idx = 0x16 + i * 100;
            for (k = 0; k < 10; k++) {
                b[idx + j * 10 + k] = 0;
            }
        }
        i++;
    }
    *(u16 *)D_8012D110 = 0;
    *(u32 *)(D_8012D110 + 0x400) = 0;
}
#endif
