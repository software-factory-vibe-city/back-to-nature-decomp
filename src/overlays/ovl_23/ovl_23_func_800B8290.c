#include "common.h"

s32 func_80012A34(s32 arg0);
extern u16 D_800BBA7C[];
extern u16 D_800BBA88[];
extern u8 D_800BF87C[];

void ovl_23_func_800B8290(void) {
    s32 i = 0;
    s32 one = 1;
    u16 *src = D_800BBA7C;
    u8 *p = D_800BF87C;
    u16 temp;

    for (; i < 6; i++, p += 0x44) {
        temp = *src++;
        *(u16 *)(p + 0x204) = i;
        *(u16 *)(p + 0x206) = one;
        *(u16 *)(p + 0x208) = one;
        *(u16 *)(p + 0x20A) = 2;
        *(u16 *)(p + 0x20C) = 0;
        *(u32 *)(p + 0x210) = 0x17000;
        *(u16 *)(p + 0x244) = temp;
        *(u16 *)(p + 0x20E) = D_800BBA88[func_80012A34(4)];
    }
}
