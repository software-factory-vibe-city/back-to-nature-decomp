#include "common.h"

void func_8001AF70(u16 arg0, u16 arg1);

void ovl_11_func_801129A0(void) {
    char *base;
    u16 v1;
    u16 a0v;

    base = (char *)&D_8006C838;
    v1 = *(u16 *)(base + 0x44BA);
    a0v = *(u16 *)(base + 0x44BC);
    base += 0x8000;
    *(u16 *)(base + 0x5BDC) = v1;
    *(u16 *)(base + 0x5BDE) = a0v;
    func_8001AF70(0x4E, 0);
    *(u16 *)(base + 0x6770) = 0;
}
