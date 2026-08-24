#include "common.h"

s32 ovl_11_func_800DBF60(void) {
    s16 *p = (s16 *)D_8006C838;
    s32 i = 1;

    for (; i < 5; i++) {
        if (p[0x3D3C + i * 6] != -1) {
            return 1;
        }
    }
    return 0;
}
