#include "common.h"

void func_80020A40(void);

void ovl_27_func_800BABD4(void) {
    char *base;

    /* Two-stage base formation keeps +0x8000 as runtime ori/addu (matched idiom) */
    base = (char *)&D_8006C838;
    base += 0x8000;
    *(s16 *)(base + 0x64CC) = 0;
    *(s16 *)(base + 0x64CE) = 1;
    *(s16 *)(base + 0x64D0) = 1;
    *(s16 *)(base + 0x64D2) = 1;
    func_80020A40();
}
