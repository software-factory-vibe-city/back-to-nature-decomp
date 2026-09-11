#include "common.h"

INCLUDE_ASM("build/ovl_11/asm/nonmatchings/ovl_11_func_800E5524", ovl_11_func_800E5524);


/* PARKED by /auto_decompilation_loop on 2026-09-11T05:43:21.109Z.
 * Reason: escalation-exhausted.
 * Escalation reached: deepseek-v4-flash.
 * The best non-matching attempt is preserved verbatim below, disabled.
 * Findings and the decision needed: notes/human-needed-approvals/ovl_11_func_800E5524.md
 */

#if 0
/* Best non-matching attempt, preserved for the next session. */
#include "common.h"

void ovl_11_func_800E5524(u8 *arg0, u8 *arg1, s32 arg2)
{
    u8 delim;
    s32 cnt;
    u8 ch;
    u8 fill_char;
    s32 fill_count;
    s32 temp;

    delim = *arg1;
    arg1++;
    cnt = 0;
    if (arg2 <= 0) {
        return;
    }
    do {
        ch = *arg1;
        if (ch == delim) {
            arg1++;
            fill_char = *arg1++;
            fill_count = *arg1;
            temp = cnt + 1;
            if (fill_count != 0) {
                do {
                    *arg0++ = fill_char;
                    fill_count--;
                } while (fill_count != 0);
            }
        } else {
            *arg0++ = ch;
            temp = cnt + 1;
        }
        cnt = temp;
        arg1++;
    } while (cnt < arg2);
}
#endif
