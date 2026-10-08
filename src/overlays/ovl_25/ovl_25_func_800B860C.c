#include "common.h"

extern s16 D_800BFE44;
extern u8 D_800BCD21;
extern s16 D_800BCD48[4];

void ovl_25_func_800B93E4(void);
void func_80022738(void);
void func_800226D8(s32 arg0);
void func_80017B18(s32 arg0);
s32 func_8002261C(s32 arg0, s32 arg1);
s32 ovl_25_func_800B9B00(s16 *arg0, s16 arg1, s16 arg2);
void ovl_25_func_800B8340(void);
s32 func_8001FABC(s16 arg0);

void ovl_25_func_800B860C(void) {
    char *ref;
    char *base;
    char *p;

    ovl_25_func_800B93E4();
    ref = (char *)&D_800BFE44;
    if (*(s16 *)(ref + 0x4CC) == 0) {
        func_80022738();
        func_80017B18(0);
        func_800226D8(0);
        func_8002261C(4, 0x35);
        ovl_25_func_800B9B00((s16 *)(ref + 0x2E0), 9, 0x3B);
    }
    *(u16 *)(ref + 0x4CC) = *(u16 *)(ref + 0x4CC) + 1;
    if (*(s16 *)(ref + 0x4CC) >= 0x3C) {
        ovl_25_func_800B8340();
        *(s16 *)(ref + 0x4C8) = func_8001FABC(0x38);
        func_80022738();
        base = (char *)&D_8007AFF0;
        p = base + 0x20000;
        D_800BFE44 = 2;
        *(u16 *)(ref + 0x4CC) = 0;
        *(u16 *)(ref + 0xC) = 0;
        *(u16 *)(p + 0x53B6) = 0;
        *(u16 *)(p + 0x53B4) = *(u16 *)(ref + 0x20);
        *(u16 *)(p + 0x53B8) = *(u16 *)(ref + 0x24);
        ovl_25_func_800B9B00((s16 *)(ref + 0x2E0), 0xA, 0);
        D_800BCD21 = 1;
        D_800BCD48[0] = 0x85A;
        D_800BCD48[1] = 0;
        D_800BCD48[2] = -0x30A;
    }
}
