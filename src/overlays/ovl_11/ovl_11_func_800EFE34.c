#include "common.h"

s32 ovl_11_func_800EFE34(s32 *ptr, s32 arg1, s32 arg2) {
    switch (arg2) {
    case 0:
        *ptr = arg1;
        break;
    case 1:
        *ptr = *ptr + arg1;
        break;
    case 2:
        *ptr = *ptr - arg1;
        break;
    case 3:
        *ptr = *ptr * arg1;
        break;
    case 4:
        if (arg1 != 0) {
            *ptr = *ptr / arg1;
        }
        break;
    case 5:
        if (arg1 != 0) {
            *ptr = *ptr % arg1;
        }
        break;
    }
    return 1;
}
