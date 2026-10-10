#include "common.h"
#include "psyq/libspu.h"

void ovl_21_func_800BA4C0(void);
s32 func_800226A4(void);
void func_80022738(void);
void ovl_21_func_800B9798(s16 arg0, s16 arg1);
void func_80017B18(s32 arg0);
void func_800226D8(s32 arg0);
s32 func_8001FABC(s16 arg0);
s32 func_8002261C(s32 arg0, s32 arg1);

void ovl_21_func_800B871C(void) {
    u8 *base;
    u8 *p;
    u8 *q;
    u8 *r;

    ovl_21_func_800BA4C0();
    base = (u8 *)D_800C0448;
    if (*(s16 *)(base + 0x988) == -1) {
        if (func_800226A4() == 2) {
            func_80022738();
            *(s16 *)(base + 0x988) = 0;
            D_800C0448[0] = 4;
            return;
        }
    }
    p = (u8 *)D_800C0448;
    if (*(s16 *)(p + 0x988) >= 2) {
        s32 status;

        *(s16 *)(p + 0x988) = *(u16 *)(p + 0x988) + 1;
        status = SpuGetKeyStatus(D_800BCC60[*(s16 *)(p + 0x986)]);
        if (status == 0 || *(s16 *)(p + 0x988) >= 0x96) {
            ovl_21_func_800B9798(0, 0);
            func_80017B18(1);
            func_800226D8(1);
            *(s16 *)(p + 0x988) = -1;
            return;
        }
    }
    q = (u8 *)D_800C0448;
    if (*(s16 *)(q + 0x988) == 1) {
        if (func_800226A4() == 5) {
            *(s16 *)(q + 0x986) = func_8001FABC(0x45);
            ovl_21_func_800B9798(0, 0xB);
            *(s16 *)(q + 0x988) = 2;
        }
    }
    r = (u8 *)D_800C0448;
    if (*(s16 *)(r + 0x988) == 0) {
        func_80022738();
        func_80017B18(0);
        func_800226D8(0);
        func_8002261C(4, D_800BCCC4[*(s16 *)(r + 0x640)]);
        *(s16 *)(r + 0x988) = 1;
    }
}
