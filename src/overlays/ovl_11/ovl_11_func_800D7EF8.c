#include "common.h"
#include "psyq/stddef.h"
#include "psyq/libgte.h"

typedef struct {
    s32 unk0;
    s32 unk4;
    s32 unk8;
    s32 unkC;
} Ovl11_D7EF8_Arg0Copy;

s32 ovl_11_func_800D7EF8(s32 *arg0, u16 *arg1, u16 *arg2, void *arg3) {
    Ovl11_D7EF8_Arg0Copy tmp;
    u8 *base;
    u8 *p;
    s16 temp_a1;
    s16 temp_a3;
    s16 temp_a0;
    s16 temp_v1;
    s32 *ptr;
    s32 idx;
    s16 want;
    u8 *tbl;

    tmp = *(Ovl11_D7EF8_Arg0Copy *)arg0;
    *arg1 = *(u16 *)arg0 + 0x1130;
    *arg2 = 0x640 - *(u16 *)((u8 *)arg0 + 8);
    temp_a0 = (s16)*arg2;
    temp_a1 = (s16)*arg1;
    *arg1 = (s16)*arg1 / 399;
    *arg2 = (s16)*arg2 / 399;
    if (temp_a1 < 0) {
        *arg1 -= 1;
        return 2;
    }
    temp_a3 = (s16)*arg1;
    if (temp_a3 >= 0x2D) {
        return 3;
    }
    if (temp_a0 < 0) {
        *arg2 -= 1;
        return 2;
    }
    temp_v1 = (s16)*arg2;
    if (temp_v1 >= 0x19) {
        return 3;
    }
    if ((u16)*arg1 >= 0x2D) {
        return 1;
    }
    if (temp_v1 < 0) {
        return 1;
    }
    want = 1;
    base = (u8 *)&D_8007AFF0;
    idx = (temp_v1 * 0x2D + temp_a3) * 4;
    p = base + 0x20000;
    tbl = p + 0x3608;
    ptr = *(s32 **)(tbl + idx);
    if (*(s16 *)(p + 0x5476) != want || (*ptr & 8) != 0) {
        return 0;
    }
    return 1;
}
