#include "common.h"

/* GP-relative targets prove this TU declared D_8005E5C0, D_8005E5B4, D_8005E5C4 */
s32 D_8005E5B4;
s32 D_8005E5C0;
s32 D_8005E5C4;

void SetVal8005E2BC(s32); /* extern */
void SetVal8005E334(s32); /* extern */

void func_800226F0(void) {
    D_8005E5C0 = 0;
    func_80022DF8();
    D_8006C904 = 0;
    SetVal8005E2BC(1);
    SetVal8005E334(1);
    D_8005E5B4 = 2;
    D_8005E5C4 = -1;
}
