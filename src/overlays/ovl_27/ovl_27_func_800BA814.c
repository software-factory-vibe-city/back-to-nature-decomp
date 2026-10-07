#include "common.h"
#include "game_types.h"

s32 ovl_27_func_800BA814(void) {
    s32 idx;
    s32 offset;
    u8 *dst;
    void *src;

    if (((D8006C838View *)D_8006C838)->field_18 >= 0) {
        idx = ((D8006C838View *)D_8006C838)->field_18;
        if (idx >= 4) {
            idx = 3;
        }
    } else {
        idx = 0;
    }
    dst = (u8 *)((D8006C838View *)D_8006C838)->field_1C + 6;
    src = D_800C4A60[idx].field_4;
    offset = idx * 8;
    memcpy(dst, src, 0x1000);
    ((D8006C838View *)D_8006C838)->field_18 = *(s32 *)((u8 *)D_800C4A60 + offset);
    return 1;
}
