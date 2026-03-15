#include "common.h"

extern s32 D_8005E554;

s32 func_80020E38(void) {
    register s32 *base asm("v0");
    register s32 index asm("v1");
    
    base = &D_8006BF48;
    index = D_8005E554;
    return base[index];
}
