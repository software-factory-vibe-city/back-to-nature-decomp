#include "common.h"

typedef struct {
    s16 field_0;
    s16 field_2;
    s16 field_4;
    s16 field_6;
} Ovl19Rec8;

void ovl_19_func_800B8544(void) {
    s32 i;
    s16 *dst;
    Ovl19Rec8 *src;
    s16 *d;
    u16 *e;
    s32 idx;
    char *base;
    s32 val;

    i = 0;
    src = (Ovl19Rec8 *)D_800BCF0C;
    do {
        dst = D_800BF4C0 + i * 0x20;
        dst[0x50] = i;
        dst[0x51] = 0;
        dst[0x52] = 0;
        *(Ovl19Rec8 *)(dst + 0x54) = *src;
        src++;
        i++;
    } while (i < 3);
    d = D_800BF4C0;
    e = D_800BCEF0;
    idx = d[4] * 2;
    base = (char *)D_8006C838;
    val = (s16)*(u16 *)(base + 0xE61C);
    d[0x73] = e[idx + val % 2];
}
