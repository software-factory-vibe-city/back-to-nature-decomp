#include "common.h"

s32 D_8005E554;

s32 func_80020E38(void) {
    s32 *base;
    s32 index;
    
    base = &D_8006BF48;
    index = D_8005E554;
    return base[index];
}
