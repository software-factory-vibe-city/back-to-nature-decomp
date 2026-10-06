#include "common.h"

extern u16 D_800BF892[];
s32 func_80012A34(s32 arg0);

void ovl_23_func_800B97E0(void) {
    s32 i;
    s32 a0;
    s32 a1;

    for (i = 0; i < 6; i++) {
        D_800BF892[i] = 0xFF;
        a0 = func_80012A34(10);
        a1 = 0;
        while (a1 <= i) {
            if (D_800BF892[a1] == a0) {
                a0++;
                if (a0 >= 10) {
                    a0 = 0;
                }
                a1 = 0;
            }
            a1++;
        }
        D_800BF892[i] = a0;
    }
}
