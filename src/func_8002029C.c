#include "common.h"

extern void SsSeqSetVol(short, short, short);

s32 func_8002029C(s32 arg0, s32 arg1, s32 arg2, s32 arg3) {
    if (D_8006C088[arg1 + arg0][0] == 0) {
        SsSeqSetVol((s16)(&D_8006BFC8)[arg0], (s16)arg3, (s16)arg3);
    }
    return 0;
}
