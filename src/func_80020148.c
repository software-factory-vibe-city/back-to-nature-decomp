#include "common.h"

s32 D_8005E550;

s32 func_80020148(s32 arg0) {
    (&D_8006BF48)[D_8005E550] = arg0 * 2;
    D_8005E550 += 1;
    return 0;
}
