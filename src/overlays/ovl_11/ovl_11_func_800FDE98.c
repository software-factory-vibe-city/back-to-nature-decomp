#include "common.h"

extern s16 D_80127370[];
extern s16 ovl_11_func_800FDEDC(s16 arg0);

s32 ovl_11_func_800FDE98(u16 arg0) {
    if (arg0 >= 5) {
        arg0 = 4;
    }
    return ovl_11_func_800FDEDC(D_80127370[arg0]);
}
