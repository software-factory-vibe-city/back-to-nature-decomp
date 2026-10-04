#include "common.h"
#include "game_types.h"

s32 ovl_21_func_800B9844(void) {
    s16 count;
    s32 sel;
    s32 tmp;
    s32 i;
    s32 j;
    s32 one;
    s32 pos;
    s32 step;
    u8 *raw;
    UnkStruct800C0448 *base;
    s32 *tbl;
    s32 *p;

    sel = 0;
    i = 0;
    raw = (u8 *)D_800C0448;
    count = *(s16 *)(raw + 0x64A);
    for (; i < 6; i++) {
        if (count > 0) {
            one = 1;
            base = (UnkStruct800C0448 *)D_800C0448;
            tbl = (s32 *)((u8 *)base + 0x34);
            p = (s32 *)((u8 *)tbl + (((i << 5) + i) << 3));
            pos = (sel << 16) + 0x10000;
            step = 0x10000;
            j = *(s16 *)((u8 *)base + 0x64A);
            do {
                if (*p == one) {
                    tmp = pos;
                    pos += step;
                    sel = tmp >> 16;
                }
                p = (s32 *)((u8 *)p + 0x4C);
            } while (--j);
        }
    }
    return sel;
}
