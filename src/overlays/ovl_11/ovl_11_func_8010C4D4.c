#include "common.h"

INCLUDE_ASM("build/ovl_11/asm/nonmatchings/ovl_11_func_8010C4D4", ovl_11_func_8010C4D4);


/* PARKED by /auto_decompilation_loop on 2026-09-11T08:17:30.740Z.
 * Reason: escalation-exhausted.
 * Escalation reached: deepseek-v4-flash.
 * The best non-matching attempt is preserved verbatim below, disabled.
 * Findings and the decision needed: notes/human-needed-approvals/ovl_11_func_8010C4D4.md
 */

#if 0
/* Best non-matching attempt, preserved for the next session. */
#include "common.h"

typedef struct {
    u16 field_0;
    u16 field_2;
} Cell4;

extern Cell4 D_80075854[];

s32 ovl_11_func_8010C4D4(void) {
    s32 i;
    Cell4 *arr;
    s32 j;

    for (i = 0; i < 3; i++) {
        s32 searchVal;

        if (i == 1) {
            searchVal = 0xA2;
        } else if (i >= 2) {
            searchVal = 0xA3;
        } else if (i == 0) {
            searchVal = 0xA1;
        }
        arr = D_80075854;
        for (j = 0; j < 99; j++) {
            if (arr->field_0 == searchVal) {
                arr->field_0 = 0;
                return searchVal;
            }
            arr++;
        }
    }
    return 0;
}
#endif
