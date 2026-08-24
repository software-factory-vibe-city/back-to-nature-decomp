#include "common.h"

extern u16 D_801282E4[];
extern u16 D_801282F0[];

u16 ovl_11_func_8011DEBC(s16 arg0, s32 arg1) {
    if ((arg1 << 0x10) == 0) {
        return D_801282E4[arg0];
    }
    return D_801282F0[arg0];
}
