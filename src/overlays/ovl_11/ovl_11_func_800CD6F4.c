#include "common.h"

extern s32 D_801231F4;
extern s32 D_801231F8;
extern u16 D_801232B4[];

void ovl_11_func_800CD6F4(void *arg0) {
    if (*(u32 *)((u8 *)arg0 + 0x6C) & 8) {
        D_801231F8 = 0;
        D_801231F4 = D_801232B4[*(s16 *)((u8 *)arg0 + 0x30)];
    }
}
