#include "common.h"

s32 func_80012A34(s32 arg0);

void ovl_11_func_800DA454(u16 *arg0, s32 arg1) {
    if (arg1 != 0) {
        if (*arg0 == 0x3F) {
            if (func_80012A34(arg1 & 0xFFFF) == 0) {
                *arg0 = 0x175;
            }
        }
    }
}
