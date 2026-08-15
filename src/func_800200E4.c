#include "common.h"

s32 D_8005E544;
s32 D_8005E548;
s32 D_8005E54C;
s32 D_8005E558;

/* Sound request: if the sound request counter D_8005E558 is nonzero,
 * stop the current sound (func_80020A94), record arg0/arg1 and 0x1010 in
 * the pending-parameter slots, bump the counter, and reset the sound
 * engine (func_8001FF98). Returns 0. */
s32 func_800200E4(s32 arg0, s32 arg1) {
    if (D_8005E558) {
        func_80020A94();
    }
    D_8005E548 = arg0;
    D_8005E54C = arg1;
    D_8005E544 = 0x1010;
    D_8005E558++;
    func_8001FF98();
    return 0;
}
