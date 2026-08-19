#include "common.h"

u16 *func_800191B4(u16 *, u16, s32, s32);                /* extern */
s32 func_8001945C(u16 *, u16, s16);                      /* extern */

/* TU-owned globals (GP-relative — tentative definitions). */
u16 D_8005E444;
s16 D_8005E4A0;
s16 D_8005E4A2;
s16 D_8005E4A4;
u16 *D_8005E4A8;
s32 D_8005E4AC;
s32 D_8005E4B4;
s32 D_8005E4B8;
u16 D_8005E446;

void func_8001A19C(void) {
    u16 *v;
    u16 count;
    u32 i;

    count = 1;
    if (D_8005E444 != 0) {
        count = D_8005E444;
    }
    i = 0;
    do {
        v = func_800191B4(D_8005E4A8, D_80049068[i], 1, count);
        if (v != 0) {
            D_8005E4A8 = v + 1;
            if (*D_8005E4A8 == 0xFFFE) {
                D_8005E4A8 = v + 2;
            }
            D_8005E4A0 = 3;
            D_8005E4AC = 0;
            D_8005E4A2 = 0;
            D_8005E4B4 = 1;
            D_8005E4B8 = 0;
            D_8005E4A4 = 0;
            D_8005E446 = D_80049070[i];
            D_8005E444 = func_8001945C(D_8005E4A8, 0xFFFF, 0);
            return;
        }
        i++;
    } while (i < 3);
}
