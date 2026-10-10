#include "common.h"

typedef struct {
    s32 unk0;
    s32 unk4;
    s32 unk8;
    s32 unkC;
} Ovl11_8011E090_Arg0Copy;

typedef struct {
    s32 *cells[7 * 0x2D];
} CellTable;

s32 ovl_11_func_8011E090(s32 *arg0, u16 *arg1, u16 *arg2, void *arg3) {
    Ovl11_8011E090_Arg0Copy tmp;
    u8 *base;
    u8 *p;
    s16 temp_a1;
    s16 temp_a3;
    s16 temp_a0;
    s16 temp_v1;
    s32 *ptr;
    s32 idx;

    tmp = *(Ovl11_8011E090_Arg0Copy *)arg0;
    *arg1 = *(u16 *)arg0 + 0x654;
    *arg2 = 0x4C4 - *(u16 *)((u8 *)arg0 + 8);
    temp_a0 = (s16)*arg2;
    temp_a1 = (s16)*arg1;
    *arg1 = (s16)*arg1 / 400;
    *arg2 = (s16)*arg2 / 400;
    if (temp_a1 < 0) {
        *arg1 -= 1;
        return 2;
    }
    temp_a3 = (s16)*arg1;
    if (temp_a3 >= 7) {
        return 3;
    }
    if (temp_a0 < 0) {
        *arg2 -= 1;
        return 2;
    }
    temp_v1 = (s16)*arg2;
    if (temp_v1 >= 7) {
        return 3;
    }
    base = (u8 *)&D_8007AFF0;
    idx = (temp_v1 * 0x2D + temp_a3) * 4;
    p = base + 0x20000;
    ptr = *(s32 **)(p + 0x3608 + idx);
    if (*(s16 *)(p + 0x5476) == 6) {
        if (!(*ptr & 8)) {
            return 1;
        }
    }
    return 0;
}
