#include "common.h"

void func_80015814(u16 *arg0, s32 arg1);

extern u16 D_800C013C;
extern u16 D_800C024C;
extern u16 D_800C0334;

void ovl_25_func_800BA2E8(void) {
    u16 *q;
    u16 *p;
    u16 *base;
    s32 i;
    u16 *base2;

    func_80015814(&D_800C024C, 4);
    func_80015814((&D_800C024C + 0x48), 4);
    func_80015814((&D_800C024C + 0x18), 4);
    func_80015814((&D_800C024C + 0x30), 4);
    base = &D_800C024C;
    q = base - 0x1D8;
    p = base - 0x1F0;
    for (i = 5; i >= 0; i--) {
        func_80015814(p, 4);
        func_80015814(q, 4);
        q += 0x3C;
        p += 0x3C;
    }
    base2 = &D_800C013C;
    p = base2 + 0x18;
    q = base2;
    for (i = 1; i >= 0; i--) {
        func_80015814(q, 4);
        func_80015814(p, 4);
        p += 0x3C;
        q += 0x3C;
    }
    func_80015814(&D_800C0334, 4);
    func_80015814((&D_800C0334 + 0x18), 4);
    func_80015814((&D_800C0334 + 0x30), 4);
    func_80015814((&D_800C0334 + 0x48), 4);
    func_80015814((&D_800C0334 + 0x60), 4);
    func_80015814((&D_800C0334 + 0x78), 4);
}
