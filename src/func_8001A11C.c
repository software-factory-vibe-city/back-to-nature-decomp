#include "common.h"

u16 *func_800191B4(u16 *, u16, s32, s32);                /* extern */
void func_80019600(void);
/* TU-owned globals (GP-relative — tentative definitions). */
u16 D_8005E444;
s16 D_8005E4A0;
s16 D_8005E4A2;
u16 *D_8005E4A8;
s32 D_8005E4AC;
s32 D_8005E4B4;
s32 D_8005E4B8;

void func_8001A11C(void) {
    s32 temp_v0;
    u16 var_a3;
    u16 *ptr;

    var_a3 = 1;
    ptr = D_8005E4A8;
    if (D_8005E444 != 0) {
        var_a3 = D_8005E444;
    }
    temp_v0 = func_800191B4(ptr, 0xFFB, 1, var_a3);
    if (temp_v0 != 0) {
        D_8005E4A8 = temp_v0 + 2;
        D_8005E4AC = 0;
        D_8005E4A2 = 0;
        D_8005E4A0 = 3;
        D_8005E4B4 = 1;
        func_80019600();
        D_8005E4B8 = 0;
        if (*D_8005E4A8 == 0xFFFE) {
            D_8005E4A8 += 1;
        }
    }
}
