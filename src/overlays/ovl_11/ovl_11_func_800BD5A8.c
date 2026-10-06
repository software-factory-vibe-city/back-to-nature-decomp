#include "common.h"

void func_80014BCC(s32 arg0, s32 arg1, s32 arg2, s32 arg3, s32 arg4);
void func_8001719C(u8 *arg0);
void ovl_11_func_800DA588(s32 arg0);

extern s32 D_801227CC[];
extern s32 *D_80125528[];
extern u8 D_800957F8[];

void ovl_11_func_800BD5A8(s32 arg0) {
    s32 *p;
    s32 *q;
    s32 n;

    if (arg0 != -1) {
        p = &D_801227CC[arg0];
        q = D_80125528[arg0];
        n = *(s32 *)((u8 *)q + (*q * 4) + 4);
        func_80014BCC(0, p[0], p[1] - p[0], 0, D_8005E3B0 + 0x4290);
        memcpy(&D_800957F8, (void *)(D_8005E3B0 + 0x4290), n);
        n = n + 0x4290;
        func_8001719C((u8 *)(D_8005E3B0 + n));
        ovl_11_func_800DA588(arg0);
    }
}
