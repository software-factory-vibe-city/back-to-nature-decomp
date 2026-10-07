#include "common.h"
#include "psyq/libspu.h"

void ovl_21_func_800BA4C0(void);
void func_80022738(void);
void func_800132F0(s32 arg0, s32 arg1, s32 arg2);
s32 func_800226A4(void);
s32 func_8001FABC(s16 arg0);

void ovl_21_func_800B93F0(void) {
    u8 *base;
    u8 *p;

    ovl_21_func_800BA4C0();
    base = (u8 *)D_800C0448;
    if (*(s16 *)(base + 0x988) > 0) {
        s32 status;

        *(s16 *)(base + 0x988) = *(u16 *)(base + 0x988) + 1;
        status = SpuGetKeyStatus(D_800BCC60[*(s16 *)(base + 0x986)]);
        if (status == 0 || *(s16 *)(base + 0x988) >= 0x96) {
            func_80022738();
            *(s16 *)(base + 0x988) = 0;
            func_800132F0(0xA, 0, 2);
            D_800C0448[0] = 0xD;
            return;
        }
    }
    p = (u8 *)D_800C0448;
    if (*(s16 *)(p + 0x988) == 0) {
        if (func_800226A4() == 5) {
            *(s16 *)(p + 0x986) = func_8001FABC(0x44);
            *(s16 *)(p + 0x988) = 1;
        }
    }
}
