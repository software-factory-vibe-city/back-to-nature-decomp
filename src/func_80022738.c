#include "common.h"

void SetVal8005E2BC(s32); /* extern */
void SetVal8005E334(s32); /* extern */

void func_80022738(void) {
    char *p;

    SetVal8005E2BC(1);
    SetVal8005E334(1);
    p = (char *)&D_8006C838;
    if (*(u8 *)(p + 0xCC) == 4) {
        *(u8 *)(p + 0xCC) = 5;
        D_8005E5CC = 0;
        D_8005E5B4 = 0xF;
    }
}
