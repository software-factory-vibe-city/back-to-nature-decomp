#include "common.h"
#include "psyq/libsnd.h"

/* Tentative definitions — this TU owns these GP-relative globals. */
s32 D_8005E55C;

void func_80020A40(void) {
    SsSetStereo();
    D_8005E55C = 1;
    func_800218BC();
}
