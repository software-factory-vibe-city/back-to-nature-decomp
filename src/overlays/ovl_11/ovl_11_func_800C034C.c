#include "common.h"

s32 func_80012A34(s32 arg0);

void ovl_11_func_800C034C(u8 *arg0) {
    u16 flags;
    s32 a;
    s32 b;
    s32 c;
    s32 f;
    s32 e;
    s32 d;

    flags = *(u16 *)(arg0 + 0xC);
    if (flags & 0x4000) {
        if (!(flags & 0x1000)) {
            a = 0x69A;
            b = 0xF0;
            c = 0x3C;
            d = 0x14;
            e = 0x5;
            f = 0xF;
        } else {
            a = 0x4A;
            b = 0x12C;
            c = 0xB4;
            d = 0xC;
            e = 0xA;
            f = 0x1E;
        }
    } else {
        a = 0x19;
        b = 0xF0;
        c = 0xA0;
        d = 0xF;
        e = 0x14;
        f = 0x14;
    }
    *(s16 *)(arg0 + 8) = func_80012A34(a & 0xFFFF) + d;
    func_80012A34(a & 0xFFFF);
    *(s16 *)(arg0 + 0) = func_80012A34(b) + f;
    func_80012A34(a & 0xFFFF);
    *(s16 *)(arg0 + 2) = func_80012A34(c) + e;
    *(s16 *)(arg0 + 0xA) = 0;
}
