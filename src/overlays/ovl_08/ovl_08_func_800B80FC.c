#include "common.h"

extern s32 D_800B8500;

void ovl_08_func_800B80FC(void) {
    if (func_8001FD74() != 0) {
        D_800B8500 += 1;
    }
}
