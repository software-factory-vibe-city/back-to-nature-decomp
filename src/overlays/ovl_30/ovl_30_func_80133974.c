#include "common.h"

void ovl_30_func_80133974(u8 *arg0, s32 arg1, s32 arg2, s32 arg3, s32 arg4) {
    s32 var_v1_2;
    s32 var_v0;
    s32 var_v1;

    if (arg1 != 0) {
        var_v1 = 0;
        switch (arg1) {
        case 1:
            if (arg3 == 0) {
                var_v1 = *arg0;
            } else {
                var_v1 = *(s8 *) arg0;
            }
            break;
        case 2:
            if (arg3 == 0) {
                var_v1 = *(u16 *) arg0;
            } else {
                var_v1 = *(s16 *) arg0;
            }
            break;
        case 4:
            var_v1 = *(s32 *) arg0;
            break;
        }
        var_v1_2 = var_v1 + arg4;
        if (arg2 < 0) {
            if (arg2 < var_v1_2) {
                goto block_18;
            }
            var_v0 = var_v1_2 < arg3;
            goto block_19;
        }
        if (arg2 < var_v1_2) {
block_18:
            var_v1_2 = arg3;
        } else {
block_19:
            var_v0 = var_v1_2 < arg3;
            if (var_v0 != 0) {
                var_v1_2 = arg2;
            }
        }
        switch (arg1) {
        case 1:
            *arg0 = (u8) var_v1_2;
            return;
        case 2:
            *(u16 *) arg0 = var_v1_2;
            return;
        case 4:
            *(s32 *) arg0 = var_v1_2;
            return;
        }
    }
}
