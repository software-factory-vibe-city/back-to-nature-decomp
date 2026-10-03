#include "common.h"

typedef struct __attribute__((packed, aligned(2))) {
    s32 unk0;
    s16 unk4;
} Unaligned6;

extern u8 D_800BCFF0[];

void ovl_27_func_800BAC14(void) {
    Unaligned6 *src;
    Unaligned6 *dst;
    char *base;
    u32 i;

    base = (char *)&D_8006C838;
    dst = (Unaligned6 *)(base + 0x468A);
    src = (Unaligned6 *)D_800BCFF0;
    for (i = 0; i < 5; i++) {
        dst[i] = src[i];
    }
}
