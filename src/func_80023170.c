#include "common.h"

/* TU-owned globals: gp-relative stores in the target (sw/sh %gp_rel) prove
 * this TU declared D_8005E360, D_8005E348 and D_8005E344 (ADR-0001 §2.4).
 * Neighbouring TUs (func_80023DBC.c / func_80023A74.c / func_80023100.c) carry
 * the same tentative common definitions (-fcommon merges them at link). */
u16 *D_8005E360;
s32 D_8005E348;
u16 D_8005E344;

void func_80023100(void);
void func_80023A74(void);

void func_80023170(u16 *arg0) {
    func_80023100();
    D_8005E360 = arg0;
    func_80023A74();
    D_8005E348 = 0;
    D_8005E344 = 1;
}
