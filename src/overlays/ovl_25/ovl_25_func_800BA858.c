#include "common.h"

extern s16 D_800BFE44;
extern u8 D_800BCD21;
extern s16 D_800BCD48[4];

s32 func_8002261C(s32 arg0, s32 arg1);
s32 func_800226A4(void);

void ovl_25_func_800BA858(void) {
    char *base;
    char *p;
    char *ref;
    s16 value;

    base = (char *)&D_8007AFF0;
    p = base + 0x20000;
    ref = (char *)&D_800BFE44;
    value = *(s16 *)(p + 0x53B4);
    if (value >= *(s16 *)(ref + 0x4D2) - 0x140) {
        *(u16 *)(p + 0x53B4) = *(u16 *)(ref + 0x4D2) - 0x140;
        func_8002261C(4, 0x32);
        if (func_800226A4() == 2) {
            *(s16 *)(ref + 2) = 3;
            D_800BCD21 = 1;
            D_800BCD48[0] = 0x10CC;
            D_800BCD48[1] = 0;
            D_800BCD48[2] = 0x708;
        }
    } else {
        *(u16 *)(p + 0x53B4) = *(u16 *)(p + 0x53B4) + 0x21;
    }
}
