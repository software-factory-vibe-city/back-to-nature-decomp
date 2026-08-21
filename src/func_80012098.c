#include "common.h"

s32 func_8001205C(void);

/* Globals accessed by this function */
s32 D_8005E3B0;

s32 func_80012098(void) {
    return D_8005E3B0 - func_8001205C();
}
