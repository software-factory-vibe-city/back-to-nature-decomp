#include "common.h"
#include "include_asm.h"

INCLUDE_ASM("build/asm/nonmatchings/func_80019610", func_80019610);


/* PARKED by /auto_decompilation_loop on 2026-08-19T22:15:52.481Z.
 * Reason: escalation-exhausted.
 * Escalation reached: deepseek-v4-flash.
 * The best non-matching attempt is preserved verbatim below, disabled.
 * Findings and the decision needed: notes/human-needed-approvals/func_80019610.md
 */

#if 0
/* Best non-matching attempt, preserved for the next session. */
#include "common.h"

typedef struct CopyBlock {
    u16 data[41];
} CopyBlock;

s32 func_800197FC(s32 arg0, s32 arg1, u16 *arg2, s16 arg3, s16 arg4, s16 arg5, s32 arg6, s16 arg7); /* extern */

s32 func_80019610(s32 arg0, s32 arg1, s32 arg2, s16 arg3, s16 arg4, s16 arg5, s32 arg6, s16 arg7, s16 arg8) {
    CopyBlock buf;
    u16 *src;
    u16 *cur;
    u16 *base;
    s32 cursor;
    u32 found;
    s32 done;
    s16 a4;
    u16 v;
    u16 w;

    w = 0xFFFF;

    a4 = arg4;
    src = (u16 *)arg2;
    cursor = arg1;
    done = 0;
    do {
        CopyBlock *cp;
        cp = (CopyBlock *)src;
        buf = *cp;
        buf.data[40] = w;
        base = &buf.data[0];
        cur = base;
        found = 0;
        for (;;) {
            if (found >= 41) {
                break;
            }
            cur = base + found;
            v = *cur;
            if (v == 0xFFFE) {
                goto s_claim;
            }
            found += 1;
            if (v != 0xFFFF) {
                continue;
            }
            found -= 1;
            done = 1;
            goto s_claim;
        }
        goto s_done;
    s_claim:
        *cur = w;
    s_inc:
        found += 1;
    s_done:
        src += found;
        cursor = func_800197FC(arg0, cursor, &buf.data[0], arg3, a4, arg5, arg6, arg8);
        a4 = (s16)(a4 + arg7);
    } while (done != 1);
    return cursor;
}
#endif
