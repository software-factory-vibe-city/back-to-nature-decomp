#include "common.h"

/* CD/script state globals reached GP-relatively by this TU.
 * Tentative definitions merged via -fcommon with the sibling definitions
 * in func_8002261C.c / func_80022DF8.c / SetVal8005E5C0.c. */
s32 D_8005E5A8;
s32 D_8005E5B4;
s32 D_8005E5BC;
s32 D_8005E5C0;
s32 D_8005E5CC;

/* Callee prototypes as the original caller TU saw them. func_80022AF0's
 * result is consumed here as a full word - the target performs no 16-bit
 * extension after the call, so the caller-side prototype returned s32
 * (functions.h holds the s16 callee-side type). func_80014CBC took plain
 * words for arg4/arg5 (sw zero / sw 1 into the outgoing area), the same ABI
 * placement as the 4-byte aggregate ReadFlag parameters. */
s32 func_8001AF44(u32 arg0);
void func_8001AF70(u16 arg0, u16 arg1);
s32 func_80022AF0(void);
u8 *func_80014CBC(s32 arg0, s32 arg1, s32 arg2, u8 *arg3, s32 arg4, s32 arg5);

s32 func_80022964(void) {
    struct struct_8006C838_view *var_s0;
    s32 var_v1;

    D_8005E5BC = func_8001AF44(3);
    func_8001AF70(3, 1);
    var_s0 = (struct struct_8006C838_view *)D_8006C838;
    var_v1 = var_s0->field_0C;
    D_8005E5B4 = 0xE;
    D_8005E5C0 = var_v1;
    var_v1 |= 0x08000000;
    var_s0->field_0C = var_v1;
    func_80014CBC(func_80022AF0(), D_8005E5A8 << 13, 0x2000, (u8 *)var_s0 + 0xD8, 0, 1);
    D_8005E5CC = 0;
    var_s0->field_CC = 2;
    return 0;
}
