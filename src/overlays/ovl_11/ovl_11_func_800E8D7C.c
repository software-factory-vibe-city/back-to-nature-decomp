#include "common.h"

u16 func_80017C30(void);
void func_8001AF34(void);

s32 ovl_11_func_800E8D7C(s16 arg0) {
    if (arg0 == func_80017C30()) {
        return 1;
    }
    if (arg0 == -1) {
        func_8001AF34();
    }
    return 0;
}
