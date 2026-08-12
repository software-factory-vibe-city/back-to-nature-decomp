#include "common.h"

void func_80021E60(s32 arg0);
s32 GetVal8005E3B0(void);

void func_80021DA8(void) {
    u32 diff;
    s32 aligned;
    s32 ptr;

    memset(&D_8006C838, 0, 0xE7B8);
    memset(&D_8007AFF0, 0, 0x256E4);
    func_80021E60(0);
    diff = D_8001009C - D_80010098;
    aligned = diff >> 11;
    diff &= 0x7FF;
    aligned <<= 11;
    if (diff) {
        aligned += 0x800;
    }
    ptr = D_80010098 + aligned;
    ((s32 *)&D_8007AFF0)[1] = ptr;
    D_8007AFF0 = ptr + 0x49000;
    *(s32 *)((char *)D_8006C838 + 0x1C) = GetVal8005E3B0() - 0x1008;
}
