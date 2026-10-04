#include "common.h"

void func_8001AF70(u16 arg0, u16 arg1);

void ovl_11_func_800BFCA4(void) {
    u16 v;
    u32 i;
    char *base;

    for (i = 0; i < 5; i++) {
        func_8001AF70((u16)(i + 0x12), 0);
    }
    base = (char *)&D_8006C838;
    base += 0x8000;
    v = *(u16 *)(base + 0x64C8);
    func_8001AF70((u16)(v + 0x12), 1);
}
