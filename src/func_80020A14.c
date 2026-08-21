#include "common.h"
#include "psyq/libsnd.h"

/* Tentative definition — this TU owns this GP-relative global. */
s32 D_8005E55C;

void func_80020A14(void) {
    SsSetMono();
    D_8005E55C = 0;
    func_800218BC();
}
