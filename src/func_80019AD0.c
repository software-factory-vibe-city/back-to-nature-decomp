#include "common.h"
#include "include_asm.h"

INCLUDE_ASM("build/asm/nonmatchings/func_80019AD0", func_80019AD0);


/* PARKED by /auto_decompilation_loop on 2026-08-20T00:42:57.542Z.
 * Reason: escalation-exhausted.
 * Escalation reached: deepseek-v4-flash.
 * The best non-matching attempt is preserved verbatim below, disabled.
 * Findings and the decision needed: notes/human-needed-approvals/func_80019AD0.md
 */

#if 0
/* Best non-matching attempt, preserved for the next session. */
#include "common.h"

typedef struct CopyBlock {
    u16 data[41];
} CopyBlock;

s32 func_800199F8(s32, s32, u16 *, s16, s16, s16, s32, s16); /* extern */

s32 func_80019AD0(s32 arg0, s32 arg1, u16 *arg2, s16 arg3, s16 arg4, s16 arg5, s32 arg6, s16 arg7, s16 arg8) {
    CopyBlock buf;
    u16 *src;
    u16 *cur;
    u16 *base;
    u32 found;
    s32 done;
    s16 a4;
    u16 tmp;
    u16 se;
    u16 sf;
    s16 ap;

    a4 = arg4;
    ap = arg3;
    src = arg2;
    base = &buf.data[0];
    done = 0;
    do {
        *(CopyBlock *)base = *(CopyBlock *)src;
        found = 0;
        se = 0xFFFE;
        cur = base;
        tmp = *cur;
        sf = 0xFFFF;
        buf.data[40] = 0xFFFF;
        if (tmp != se) {
            found = 1;
            if (tmp != sf) {
            scan_again:
                if (found < 0x29U) {
                    cur = base + found;
                    tmp = *cur;
                    if (tmp != se) {
                        found += 1;
                        if (tmp == sf) {
                            found -= 1;
                            done = 1;
                            goto inc_;
                        }
                        goto scan_again;
                    }
                    goto claim_;
                }
            } else {
                done = 1;
                found = 1;
            }
        } else {
        claim_:
            *cur = 0xFFFF;
        inc_:
            found += 1;
        }
        src += found;
        arg1 = func_800199F8(arg0, arg1, buf.data, ap, a4, arg5, arg6, arg8);
        a4 = (s16)(a4 + arg7);
    } while (done != 1);
    return arg1;
}
#endif
