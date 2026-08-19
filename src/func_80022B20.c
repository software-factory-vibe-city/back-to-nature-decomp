#include "common.h"

/* Tentative definition: the target addresses D_8005E5CC gp-relatively, which
 * proves this TU declared it (ADR 0001). */
s32 D_8005E5CC;

s32 func_80022794(s32 arg0, s32 arg1, s16 arg2, s16 arg3, s16 arg4, s16 arg5, s32 *arg6, s32 arg7, s32 arg8);

s32 func_80022B20(void) {
    if (func_80022794(D_8005E3C0->field_D8 + 8, 0, 0x1A, 0xA4, 0x10B, 0x3E, &D_8005E5CC, 0xC, 1) == 1) {
        D_8006C904 = 4;
    }
    return 0;
}
