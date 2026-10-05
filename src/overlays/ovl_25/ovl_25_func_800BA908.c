#include "common.h"

extern s16 D_800BFE44;

s32 func_8002261C(s32 arg0, s32 arg1);
s32 func_800226A4(void);
s32 func_800225B8(void);

void ovl_25_func_800BA908(void) {
    char *base;
    char *p;
    char *ref;
    s16 value;

    base = (char *)&D_8007AFF0;
    p = base + 0x20000;
    ref = (char *)&D_800BFE44;
    value = *(s16 *)(p + 0x53B4);
    if (value <= *(s16 *)(ref + 0x20)) {
        *(u16 *)(p + 0x53B4) = *(u16 *)(ref + 0x20);
        func_8002261C(4, 0x33);
        if (func_800226A4() == 2) {
            if (func_800225B8() == 1) {
                *(s16 *)(ref + 2) = 4;
            } else {
                *(s16 *)(ref + 2) = 0;
            }
        }
    } else {
        *(u16 *)(p + 0x53B4) = *(u16 *)(p + 0x53B4) - 0x21;
    }
}
