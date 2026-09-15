#include "common.h"

INCLUDE_ASM("build/ovl_11/asm/nonmatchings/ovl_11_func_8011D890", ovl_11_func_8011D890);


/* PARKED by /auto_decompilation_loop on 2026-09-15T23:11:27.009Z.
 * Reason: escalation-exhausted.
 * Escalation reached: glm-5-3-flash.
 * The best non-matching attempt is preserved verbatim below, disabled.
 * Findings and the decision needed: notes/human-needed-approvals/ovl_11_func_8011D890.md
 */

#if 0
/* Best non-matching attempt, preserved for the next session. */
#include "common.h"
#include "game_types.h"

/* Scans up to nine words of the by-value record x, walking the selector
 * forward or backward depending on the mode word at 0x60, and returns the
 * first position whose word is non-zero. Falls back to the raw selector
 * when all nine probes miss. */
s16 ovl_11_func_8011D890(Ovl11Func8011D890Arg x) {
    s16 j;
    s32 i;

    for (i = 1; i < 10; i++) {
        if (x.mode == 1) {
            j = x.index + i;
        } else {
            j = x.index - i;
        }
        j = (j >= 10) ? j - 10 : j;
        j = (j < 0) ? j + 10 : j;
        if (*(s32 *)((char *)&x + ((s32)j << 2)) != 0) {
            return j;
        }
    }
    return x.index;
}
#endif
