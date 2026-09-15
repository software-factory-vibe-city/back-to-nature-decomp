#include "common.h"

void ovl_11_func_800F1E44(u32 arg0, s16 *arg1, s32 arg2) {
    s32 i;
    s32 v;

    for (i = 0; i < 3; i++) {
        if (arg2 == 1) {
            switch (i) {
            case 0:
                v = (u16) (arg0 & 0x3FF);
                break;
            case 1:
                v = (u16) ((arg0 >> 10) & 0x3FF);
                break;
            case 2:
                v = (u16) ((arg0 >> 20) & 0x3FF);
                break;
            default:
                v = 0;
                break;
            }
        } else {
            switch (i) {
            case 0:
                v = (u16) (arg0 & 0x3FF);
                break;
            case 1:
                v = (u16) ((arg0 >> 10) & 0x3FF);
                break;
            case 2:
                v = (u16) ((arg0 >> 20) & 0x3FF);
                break;
            default:
                v = 0;
                break;
            }
        }
        *arg1++ = v;
    }
}
