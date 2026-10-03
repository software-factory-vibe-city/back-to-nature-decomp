#include "common.h"

void func_8001AF70(u16 arg0, u16 arg1);

void ovl_11_func_801128B4(void) {
    char *base;
    char *base2;

    memset((u8 *)D_80074838 + 0x676C, 0x34, 0);
    base = (char *)&D_8006C838;
    base2 = base + 0x8000;
    *(s16 *)(base2 + 0x6776) = -1;
    func_8001AF70(0x1B, 1);
}
