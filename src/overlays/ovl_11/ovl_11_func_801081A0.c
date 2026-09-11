#include "common.h"

s32 ovl_11_func_801081A0(s16 arg0, u16 arg1)
{
    s32 temp_a2;
    s32 temp_a0;
    Ovl11D050Entry *ptr;
    s32 i;

    temp_a2 = 0;
    if ((u32) arg1 < 6U) {
        temp_a2 = 0x26B;
    }
    if ((u32) (arg0 - 3) < 2U) {
        temp_a2 = 0x26A;
    }
    if (temp_a2) {
        if (temp_a2 == 0x26A) {
            temp_a0 = 0x11;
        } else {
            temp_a0 = 0x10;
        }
        ptr = &D_8012D050[0];
        for (i = 3; i >= 0; i--) {
            ptr->field_0 = temp_a2;
            ptr->field_2 = temp_a0;
            ptr++;
        }
        return 1;
    }
    return 0;
}