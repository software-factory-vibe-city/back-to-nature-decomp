#include "common.h"

s32 ovl_11_func_800DBB94(s32 arg0) {
    s16 *p = (s16 *)D_8006C838;
    s32 i = 0;

    for (; i < 5; i++) {
        if (p[0x3D3C + i * 6] != -1 && p[0x3D3C + i * 6] == arg0) {
            return 1;
        }
    }
    return 0;
}
