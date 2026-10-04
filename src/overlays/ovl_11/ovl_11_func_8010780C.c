#include "common.h"

s32 func_8001AF44(u32 arg0);

/* POLICY EXCEPTION (user-approved 2026-07-31, see common.h): the target's
 * prologue dead-stores hard $v0 to 0x10($sp) before its first definition
 * ($v0 entry-liveness). CAPTURE_PREV_RET is the minimal construct that
 * reproduces the allocation, same fossil as func_8001E878. */
s32 ovl_11_func_8010780C(s32 arg0) {
    s32 tmp[2];
    CAPTURE_PREV_RET(phantom);
    char *base;
    s32 callRet;

    tmp[0] = phantom;
    base = (char *)&D_8006C838;
    if (*(s16 *)(base + 0x44BA) == 3) {
        if (*(s16 *)(base + 0x44BC) == 0x17) {
            callRet = func_8001AF44(0x1B);
            if (callRet == 1) {
                if (func_8001AF44((arg0 + 0x21) & 0xFFFF) == 0) {
                    return 1;
                }
            }
        }
    }
    return 0;
}
