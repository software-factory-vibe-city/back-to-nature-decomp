#include "common.h"

typedef struct {
    /* 0x00 */ char pad00[0x16];
    /* 0x16 */ s16 unk16;
} UnkStruct800CD4E4;

void ovl_11_func_800CD624(void) {
    char *base;
    char *p;
    s32 temp;

    base = (char *)&D_80071A00;
    temp = ovl_11_func_800CD4E4((UnkStruct800CD4E4 *)base);
    if (temp == -1) {
        temp = 0;
    }
    p = base - 0x51C8;
    *(u16 *)(p + 0x51F4) = *(u16 *)(p + 0x44CA);
    ovl_11_func_800C087C(temp);
}
