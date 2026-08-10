#include "common.h"

extern void SsUtAllKeyOff(short);
extern void SsSeqSetVol(short, short, short);
extern void SsSeqStop(short);
extern void SsSeqPlay(short, char, short);

s32 func_800201C4(s32 arg0, s32 arg1, s32 arg2, s32 arg3, s16 arg4) {
    s32 *score_base;
    s32 *score_slot;

    score_base = &D_8006C088[0][0];
    arg1 += arg0;
    score_slot = &score_base[arg1];
    if (*score_slot == -1) {
        SsUtAllKeyOff(0);
        SsSeqSetVol((s16)(&D_8006BFC8)[arg0], (s16)arg2, (s16)arg3);
        SsSeqStop((s16)(&D_8006BFC8)[arg0]);
        SsSeqPlay((s16)(&D_8006BFC8)[arg0], 1, 0);
        *score_slot = 0;
        (&D_8006C0A8[0][0])[arg1] = arg4;
    }
    return 0;
}
