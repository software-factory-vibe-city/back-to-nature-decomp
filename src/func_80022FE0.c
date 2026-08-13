#include "common.h"

void func_80022FE0(s32 *arg0) {
    s32 temp_s0;

    temp_s0 = *arg0;
    if (temp_s0 != -1) {
        func_8001719C((u8 *)arg0 + 4);
        func_80017C3C(temp_s0);
    }
}
