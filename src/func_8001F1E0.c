#include "common.h"
#include "psyq/stddef.h"
#include "psyq/libgte.h"

void func_8001F1E0(s32 *arg0, s32 arg1, s32 arg2, s32 arg3) {
    s32 temp_s1;
    s32 temp_a2;

    temp_s1 = arg3 & 0xFFF;
    temp_a2 = -arg2;
    arg0[1] = temp_a2;
    arg0[0] = (rcos(temp_s1) * arg1) >> 12;
    arg0[2] = (rsin(temp_s1) * arg1) >> 12;
}
