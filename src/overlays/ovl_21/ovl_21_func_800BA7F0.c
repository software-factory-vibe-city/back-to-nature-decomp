#include "common.h"
#include "game_types.h"

s32 ovl_21_func_800BA7F0(s16 arg0) {
    s32 sel;
    s32 tmp;
    s32 i;
    s32 one;
    s32 pos;
    s32 step;
    UnkStruct800C0448 *base;
    s32 *p;

    sel = 0;
    i = arg0 * 3;
    if (i < arg0 * 3 + 3) {
        one = 1;
        base = (UnkStruct800C0448 *)D_800C0448;
        p = (s32 *)((u8 *)base + ((((i << 5) + i) << 3) + 0x14));
        pos = 0x10000;
        step = 0x10000;
        for (; i < arg0 * 3 + 3; i++) {
            if (*p == one) {
                tmp = pos;
                pos += step;
                sel = tmp >> 16;
            }
            p = (s32 *)((u8 *)p + 0x108);
        }
    }
    return sel;
}
