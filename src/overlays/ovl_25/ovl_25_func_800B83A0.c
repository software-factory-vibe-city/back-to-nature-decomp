#include "common.h"

typedef struct {
    s16 field_0;
    s16 field_2;
    s16 field_4;
    s16 field_6;
} Ovl25Rec8;

extern s16 D_800BFE44[];
extern s16 D_800BCC10[];
extern s16 D_800BCC70[];

void ovl_25_func_800B83A0(void) {
    s32 i;
    s32 val;
    s32 one;
    s16 *dst;
    Ovl25Rec8 *src;
    Ovl25Rec8 *src2;
    u8 *base;
    u8 *base2;

    i = 0;
    one = 1;
    val = 0x32000;
    base = (u8 *)D_800BCC10;
    src = (Ovl25Rec8 *)(base + 0x30);
    do {
        dst = D_800BFE44 + i * 0x3C;
        dst[8] = i;
        dst[9] = one;
        dst[10] = 0;
        dst[11] = 0;
        dst[12] = 0;
        *(s32 *)(dst + 14) = val;
        *(Ovl25Rec8 *)(dst + 16) = *src;
        src++;
        i++;
    } while (i < 6);

    i = 0;
    base2 = (u8 *)D_800BCC70;
    src2 = (Ovl25Rec8 *)(base2 + 0x10);
    do {
        dst = D_800BFE44 + i * 0x3C;
        dst[0x170] = i;
        *(Ovl25Rec8 *)(dst + 0x178) = *src2;
        src2++;
        i++;
    } while (i < 2);

    dst = D_800BFE44;
    dst[0x171] = 0xA;
    dst[0x1AD] = 0xB;
}
