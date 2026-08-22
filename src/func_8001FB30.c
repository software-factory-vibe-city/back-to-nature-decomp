#include "common.h"
#include "psyq/libsnd.h"

extern s16 D_800492E0[];

s32 func_8001FB30(s16 arg0, s16 arg1, s16 arg2, s16 arg3) {
    s16 temp_a0;

    func_800201C4((s32) arg0, 0, (s32) arg3, (s32) arg3, (s16) (s32) arg1);
    SsUtSetReverbType(D_800492E0[arg2 * 2]);
    SsUtReverbOn();
    temp_a0 = D_800492E0[(arg2 * 2) + 1];
    SsUtSetReverbDepth(temp_a0, temp_a0);
    return 0;
}
