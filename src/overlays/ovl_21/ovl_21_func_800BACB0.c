#include "common.h"

extern s16 D_800BCC1C;
extern s16 D_800BCC1E;
extern s16 D_800BCC20;

s32 ovl_21_func_800BACB0(s16 arg0) {
    if (arg0 == 0x10 || arg0 == 0x22) {
        return D_800BCC20;
    }
    if (arg0 == 7 || arg0 == 9 || arg0 == 0x14 || arg0 == 0x16) {
        return D_800BCC1E;
    }
    return D_800BCC1C;
}
