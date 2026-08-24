#include "common.h"

typedef struct {
    /* 0x00 */ char pad_00[0x20];
    /* 0x20 */ void *field_20;
    /* 0x24 */ char pad_24[0x44F8 - 0x24];
    /* 0x44F8 */ s32 field_44F8;
} D8006C838View603C;

s32 ovl_11_func_800D603C(s32 arg0) {
    s32 idx = arg0 & 0xFFFF;
    s32 r = 0;

    if (idx == 0x97) {
        if (((D8006C838View603C *)&D_8006C838)->field_44F8 & 0x400000) {
            r = 0xA;
        }
    }
    return r + *(s16 *)((char *)((D8006C838View603C *)&D_8006C838)->field_20 + idx * 0x28 + 0x12);
}
