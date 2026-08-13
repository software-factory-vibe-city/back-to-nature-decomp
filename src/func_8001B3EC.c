#include "common.h"

/* Game callee (signature from include/functions.h; local declaration per project convention). */
void func_8001B4E4(s32 arg0);

/* TU-owned globals (GP-relative in the target; declared [1] for -G8 small-data) */
s32 D_8005E4C8[1];
u16 D_8005E4C0[1];

void func_8001B3EC(s32 arg0) {
    u8 *flags;
    u8 *base;
    s32 count;
    s32 threshold;

    flags = (u8 *)&D_8005E870;
    base = (u8 *)D_8005E4C8[arg0];
    if (base) {
        count = D_8005E4C0[arg0];
        threshold = base[2];
        count++;
        threshold >>= 1;
        D_8005E4C0[arg0] = (u16)count;
        if (threshold < (s16)count) {
            *((volatile s32 *)&D_8005E4C8[arg0]) += 3;
            base += 3;
            D_8005E4C0[arg0] = 0;
        }
        if (base[0] == 0xFF) {
            func_8001B4E4(arg0);
            return;
        }
        flags[0x36] = 0;
        flags[0x37] = 0;
        if (base[0] & 1) {
            flags[0x36] = 1;
        }
        if (base[0] & 2) {
            flags[0x37] = base[1];
        }
    }
}