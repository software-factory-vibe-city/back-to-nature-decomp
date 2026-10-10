#include "common.h"

s32 func_80012A34(s32 arg0);
void ovl_19_func_800B843C(void);

void ovl_19_func_800B82B8(void) {
    s32 i;
    s32 j;
    s32 r;

    i = 0;
    D_800BF4C0[2] = 0;
    D_800BF4C0[3] = 0;
    D_800BF4C0[4] = 0;
    D_800BF4C0[5] = 0;
    for (; i < 8; i++) {
        (*(D_800BF4C0 + 0xB0 + i)) = 0xFF;
        r = func_80012A34(0x14);
        for (j = 0; j <= i; j++) {
            if (D_800BF4C0[0xB0 + j] == r) {
                r++;
                if (r >= 0x14) {
                    r = 0;
                }
                j = 0;
            }
        }
        (*(D_800BF4C0 + 0xB0 + i)) = r;
    }
    ovl_19_func_800B843C();
    D_800BF4C0[0xB9] = 0x2D;
    D_800BF4C0[0xBA] = 0x190;
    D_800BF4C0[0xB8] = 6;
    D_800BF4C0[0xBE] = 0x50;
    D_800BF4C0[0xBF] = 0xA;
    D_800BF4C0[0xC0] = 0xA;
    D_800BF4C0[0xC1] = 0x7D;
    D_800BF4C0[0xC2] = 0x32;
    D_800BF4C0[0xC3] = 0x73;
    D_800BF4C0[0xC4] = 0x3C;
    D_800BF4C0[0xC5] = 0x73;
    D_800BF4C0[0xBB] = 2;
    D_800BF4C0[0xBC] = 0x5A;
    D_800BF4C0[0xBD] = 0xF;
    D_800BF4C0[0xC6] = 0x3C;
    D_800BF4C0[0xC7] = 0x5A;
    D_800BF4C0[0xC8] = 0x78;
    D_800BF4C0[0xC9] = 0x5A;
    D_800BF4C0[0xCA] = 0x1E;
    D_800BF4C0[0xCB] = 0xA;
    D_800BF4C0[0xCC] = 0xA;
    D_800BF4C0[0xCD] = 0xB;
    D_800BF4C0[0xCE] = 0xA;
    D_800BF4C0[0xCF] = 0xB;
}
