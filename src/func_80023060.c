#include "common.h"

/* TU-owned gp-rel global: the target's lhu/sw %gp_rel(D_8005E338) proves this
 * TU declares it; tentative definition merges via -fcommon with
 * func_8002301C / func_80023030 / func_80023288 / func_800233B4 siblings. */
u16 D_8005E338;

/* Callee prototypes as this caller TU saw them. */
void func_80015114(u32 *arg0, s16 arg1, s16 arg2, s16 arg3, s16 arg4, s32 arg5, s16 arg6);
void func_80023288(void);

s32 func_80023060(void) {
    if (D_8005E338 != 0) {
        func_80015114((u32 *)(D_8005E3C0->field_D8 + 0x6C), 0, 0, D_800A3FB0, D_800A3FB4, 0, 1);
        func_80023288();
        switch (D_8005E338) {
        case 4:
            D_8005E338 = 0;
            return -1;
        case 5:
            D_8005E338 = 0;
            return 1;
        default:
            return 2;
        }
    } else {
        return 0;
    }
}
