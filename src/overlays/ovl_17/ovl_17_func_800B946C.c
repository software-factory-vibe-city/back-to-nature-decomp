#include "common.h"

s32 func_8001FABC(s16 arg0);
u32 func_80012A34(s32 arg0);

void ovl_17_func_800B946C(void) {
    u8 *base;
    u8 *work;
    u8 *p;
    s32 i;
    s32 off;
    s32 flag;
    s16 q;

    base = D_800BD848;
    flag = 1;
    work = D_80074838;
    p = base;
    off = 0;
    for (i = 0; i < 6; i++) {
        if (*(u32 *)(base + off + 0x30) != 0) {
            if (*(s16 *)(p + 0x2A) >= *(s16 *)(base + 0x12)) {
                *(u16 *)(p + 0x2A) = *(u16 *)(p + 0x2A) - *(u16 *)(base + 0x12);
                q = (s16)((*(s16 *)(p + 0x2E) * (*(s16 *)(p + 0x36) + *(s16 *)(base + 0x0E))) / (*(s16 *)(base + 0x10) * 0xFF));
                *(u16 *)(p + 0x2E) = q + *(s16 *)(p + 0x2E);
                if (flag == 1) {
                    if (*(s16 *)(work + 0x6514) != 3) {
                        if (func_80012A34(0x64) < 0x22) {
                            *(u16 *)(base + 0x2C8) = func_8001FABC(0x3D);
                        }
                    }
                    flag = 0;
                }
            }
        }
        p += 0x50;
        off += 0x50;
    }
}
