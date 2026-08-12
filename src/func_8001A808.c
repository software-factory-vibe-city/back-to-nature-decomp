#include "common.h"

/* Game callee (signature from include/functions.h; not included to avoid
   SDK type conflicts — project convention, see func_80011370.c). */
u16 *func_80017E34(u16 *arg0, u16 *arg1);

u16 *func_8001A808(u16 *arg0, s32 arg1, s32 arg2) {
    s32 temp_v1;
    s32 flag_100;
    s32 flag_bit;

    temp_v1 = *(s32 *)((char *)arg1 + 0x34);
    flag_100 = temp_v1 & 0x100;
    if (arg2) {
        flag_bit = (((u32)temp_v1 >> 19) ^ 1) & 1;
    } else {
        flag_bit = temp_v1 & 0x80000;
    }
    if (flag_100 && flag_bit) {
        arg0 = func_80017E34(func_80017E34(arg0, (u16 *)(arg1 + 4)), D_80049084);
    }
    return arg0;
}
