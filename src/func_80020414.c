#include "common.h"

/* func_80020414 - stop the sequence for a song/track slot and mark it empty.
 *
 * Looks up D_8006C088[arg0 + arg1] (the sequence-ID slot).  If it is not the
 * -1 sentinel, calls SsSeqStop with the voice ID stored in D_8006BFC8[arg0]
 * and then writes -1 into the slot to mark it free.
 */

s32 func_80020414(s32 arg0, s32 arg1) {
    s32 *temp_s0;
    s32 *p;
    s32 temp_a1;

    p = &D_8006C088[0][0];
    temp_a1 = arg1 + arg0;
    temp_s0 = &p[temp_a1];
    if (*temp_s0 != -1) {
        SsSeqStop((s16)(&D_8006BFC8)[arg0]);
        *temp_s0 = -1;
    }
    return 0;
}
