#include "common.h"

s32 func_80012A34(s32 arg0);
extern u8 D_800BF87C[];
extern s16 D_800BBAB4[];

s32 ovl_23_func_800BA3B4(s16 arg0, s16 arg1) {
    s16 d;
    s16 val;
    s32 sel;
    u8 *base;

    base = D_800BF87C;
    d = (s16)(*(u16 *)(base + arg1 * 0x50 + 0x30) -
              *(u16 *)(base + arg1 * 0x50 + 0x32));
    if (*(s16 *)(base + 0x3A4) < d) {
        sel = 0;
    } else if (*(s16 *)(base + 0x3A6) < d) {
        sel = 1;
    } else if (*(s16 *)(base + 0x3A8) < d) {
        sel = 2;
    } else if (*(s16 *)(base + 0x3AA) < d) {
        sel = 3;
    } else {
        sel = 4;
    }
    val = D_800BBAB4[arg0 * 5 + sel];
    return val > func_80012A34(0x64);
}
