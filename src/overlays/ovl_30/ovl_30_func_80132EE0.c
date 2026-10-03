#include "common.h"
#include "game_types.h"

s32 ovl_30_func_80132EE0(s32 arg0) {
    s32 v = ((SomeStruct *)D_8005E3A8)->field_0x0;

    if (v & 0x80) {
        arg0 -= 1;
    }
    if (v & 0x20) {
        arg0 += 1;
    }
    return arg0;
}
