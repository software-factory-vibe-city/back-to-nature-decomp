#include "common.h"

extern s32 D_80070C72[5];

s32 ovl_11_func_800ED760(s16 arg0, s16 arg1, s32 arg2) {
    s32 target;
    s32 *slot;
    s16 v;
    s32 i;

    if (arg2 != 0) {
        target = D_80129560[arg0];
    } else {
        target = arg0;
    }
    slot = D_80070C72;
    i = 0;
    do {
        v = *(s16 *)slot;
        if (v == -1 || (i++, v == target)) {
            *(s16 *)slot = target;
            *((s16 *)slot + 1) = arg1;
            return 1;
        }
        slot++;
    } while (i < 5);
    return 0;
}