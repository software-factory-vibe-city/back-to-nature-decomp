#include "common.h"

s32 func_80012A34(s32 arg0);

s32 ovl_19_func_800BA33C(u8 *arg0) {
    s32 result;
    s32 flag;
    s32 cat;
    s32 i;
    s16 sum;
    s16 limit;
    s16 type;
    s32 val;

    type = *(s16 *)(arg0 + 8);
    if (type < 0x51) {
        cat = 0;
    } else if (type < 0xF1) {
        cat = 1;
    } else {
        cat = 2;
    }
    result = 0;
    flag = *(u32 *)(arg0 + 0xC) != 0;
    sum = 0;
    limit = (s16)func_80012A34(0x64);
    for (i = 0; i < 4; i++) {
        val = *(u16 *)((u8 *)D_800BCF28 + (cat << 4) + (flag << 3) + i * 2);
        sum = (s16)(sum + val);
        if (limit < sum) {
            switch (i) {
                case 0: result = 3; break;
                case 1: result = 1; break;
                case 2: result = 0; break;
                case 3: result = 2; break;
            }
            break;
        }
    }
    return result;
}
