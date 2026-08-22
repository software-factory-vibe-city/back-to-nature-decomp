#include "common.h"
#include "include_asm.h"

INCLUDE_ASM("build/asm/nonmatchings/func_80020B80", func_80020B80);


/* PARKED by /auto_decompilation_loop on 2026-08-22T05:30:25.018Z.
 * Reason: escalation-exhausted.
 * Escalation reached: deepseek-v4-flash.
 * The best non-matching attempt is preserved verbatim below, disabled.
 * Findings and the decision needed: notes/human-needed-approvals/func_80020B80.md
 */

#if 0
/* Best non-matching attempt, preserved for the next session. */
#include "common.h"
#include "psyq/libsnd.h"

/* Game callee (signature from include/functions.h). */
s32 func_80020414(s32 arg0, s32 arg1);

/* Tentative definitions — this TU owns/uses these GP-relative globals. */
s32 D_8005E540;
s32 D_8005E544;
s32 D_8005E548;
s32 D_8005E550;
s32 D_8005E554;
s32 D_8005E560;

/* func_80020B80 - sound shutdown for one song.
 * Closes the sequence bound to each track/song slot this engine has open,
 * matching the tables func_8001FF98 initialises. */
s32 func_80020B80(s32 arg0, s32 arg1) {
    s32 cur;
    s32 cand;
    s32 song;
    s32 col;

    cur = (&D_8006BFE8)[arg0];
    D_8005E540 = arg0;
    D_8005E560 = arg1;
    if (cur != -1) {
        D_8005E544 = (&D_8006BF28)[arg0];
        cand = (&D_8006C028)[arg1];
        if (((u32)cand < (u32)cur) && cand != -1) {
            D_8005E548 = cand;
            song = arg1;
        } else {
            D_8005E548 = cur;
            song = arg1;
        }
    } else {
        song = arg1;
    }
    arg1 = song;
    if (song < 6) {
        do {
            col = 0;
            do {
                SsSeqSetVol((s16)song, 0, 0);
                func_80020414(song, col);
                col++;
            } while (col <= 0);
            song++;
        } while (song < 6);
    }
    for (song = arg1; song < 6; song++) {
        if ((&D_8006BFC8)[song] != -1) {
            SsSeqClose((s16)(&D_8006BFC8)[song]);
            (&D_8006BFC8)[song] = -1;
        }
        (&D_8006C028)[song] = -1;
        (&D_8006C068)[song] = -1;
        (&D_8006C048)[song] = -1;
    }
    for (song = arg0; song < 6; song++) {
        if ((&D_8006BFA8)[song] >= 0) {
            SsVabClose((s16)(&D_8006BFA8)[song]);
            (&D_8006BFA8)[song] = -1;
        }
        (&D_8006BFE8)[song] = -1;
        (&D_8006C008)[song] = -1;
        for (col = 0; col < 1; col++) {
            D_8006C088[song][col] = -1;
            D_8006C0A8[song][col] = -1;
        }
    }
    D_8005E560 = arg1;
    D_8005E554 = 0;
    D_8005E540 = arg0;
    for (song = 0; song < 6; song++) {
        (&D_8006BF48)[song] = -1;
        (&D_8006BF68)[song] = 0;
        (&D_8006BF88)[song] = 0;
    }
    D_8005E550 = 0;
    return 0;
}
#endif
