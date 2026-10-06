#include "common.h"

typedef struct {
    s16 field_0;
    s16 field_2;
    s16 field_4;
    s16 field_6;
} Ovl19Rec8;

s32 ovl_19_func_800B85F4(void);

void ovl_19_func_800B847C(void) {
    s32 i;
    s16 *dst;
    Ovl19Rec8 *src;
    s16 *d;
    char *base;
    s16 two;

    i = 0;
    two = 2;
    src = (Ovl19Rec8 *)D_800BCEFC;
    do {
        dst = D_800BF4C0 + i * 0x24;
        dst[8] = i;
        dst[9] = two;
        dst[0xB] = 0;
        *(s32 *)(dst + 0xE) = 0;
        *(Ovl19Rec8 *)(dst + 0x10) = *src;
        src++;
        i++;
    } while (i < 2);
    d = D_800BF4C0;
    d[0xA] = 0;
    d[0x2E] = 2;
    base = (char *)D_8006C838;
    d[0xC] = *(u16 *)(base + 0xE61C);
    d[0x30] = ovl_19_func_800B85F4();
    d[0x31] = D_800BCEE8[d[4] + 1];
}
