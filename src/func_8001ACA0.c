#include "common.h"

extern s16 D_8005E454;
extern s16 D_8005E460;
extern s16 D_8005E468;

void func_8001ACA0(void) {
    register s16 temp_v1 __asm__("v1");
    register s16 temp_v0 __asm__("v0");

    temp_v1 = -1;
    temp_v0 = -3;
    D_8005E454 = temp_v1;
    D_8005E460 = temp_v1;
    D_8005E468 = temp_v0;
}
