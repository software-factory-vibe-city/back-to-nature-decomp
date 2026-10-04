#include "common.h"

void func_80014BCC(s32 arg0, s32 arg1, s32 arg2, s32 arg3, s32 arg4);
void *memcpy(void *dest, const void *src, u32 n);

void ovl_11_func_800BD1BC(s32 arg0) {
    s32 *p;

    p = &D_801227F8[arg0];
    func_80014BCC(0, p[0], p[1] - p[0], 0, D_8005E3B0 + 0x4290);
    memcpy(&D_8007F7F8, (void *)(D_8005E3B0 + 0x4290), p[1] - p[0]);
}
