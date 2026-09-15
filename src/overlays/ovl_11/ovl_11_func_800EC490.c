#include "common.h"

extern u16 D_80070D06;
extern u16 D_80070D08;
extern u16 D_80070D0A;
extern u16 D_80070D0C;

s32 ovl_11_func_800EC490(s16 arg0, s16 arg1, s32 arg2, s32 arg3) {
    if (arg0 != -1) {
        D_80129560[arg0] = D_80070D06;
    }
    if (arg1 != -1) {
        D_80129560[arg1] = D_80070D08;
    }
    if (arg2 != -1) {
        D_80129560[arg2] = D_80070D0A;
    }
    if (arg3 != -1) {
        D_80129560[arg3] = D_80070D0C;
    }
    return 1;
}
