#include "common.h"

s32 ovl_11_func_800EFDA0(s32 arg0, s32 arg1, s32 arg2) {
    s32 result = 0;
    switch (arg2) {
    case 0:
        if (arg0 >= arg1) {
            result = 1;
        }
        break;
    case 1:
        if (arg1 < arg0) {
            result = 1;
        }
        break;
    case 2:
        if (arg1 >= arg0) {
            result = 1;
        }
        break;
    case 3:
        if (arg0 < arg1) {
            result = 1;
        }
        break;
    case 4:
        if (arg0 == arg1) {
            result = 1;
        }
        break;
    default:
        result = 1;
        break;
    }
    return result;
}
