#include "common.h"

typedef struct {
    char pad_0000[0x2];
    s16 unk_2;
    u16 unk_4;
} Struct_800F501C;

void ovl_11_func_800F501C(s32 arg0, s32 arg1, s16 arg2) {
    s32 *base;
    s32 *base2;
    Struct_800F501C *p;
    u16 var_v0;

    base = (s32 *)&D_8006C838;
    base2 = base + (0x8000 >> 2);
    p = (Struct_800F501C *)(*(char **)((char *)base2 + 0x5D98) + ((arg0 * 0x18) + 0xF0));

    if (arg1 == 1) {
        var_v0 = p->unk_4 | 1;
    } else {
        var_v0 = p->unk_4 & 0xFFFE;
    }
    p->unk_4 = var_v0;

    if (arg2 == 0) {
        p->unk_2 = 0x123;
    } else {
        p->unk_2 = 0xE8;
    }
}
