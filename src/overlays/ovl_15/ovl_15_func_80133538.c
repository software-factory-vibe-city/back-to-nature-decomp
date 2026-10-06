#include "common.h"

s16 ovl_15_func_80133538(u8 *arg0, s16 arg1) {
    u8 *p;
    s16 result;
    s32 temp;
    s32 i;
    s32 v;
    u32 mask;

    p = arg0;
    result = 0;
    switch (arg1) {
    case 0:
        mask = 0x02000000;
        v = 0x10000;
        for (i = 0; i < 10; i++) {
            if ((*(u16 *)p != 0) || (*(u32 *)(p + 0x34) & mask)) {
                temp = v;
                v += 0x10000;
                result = temp >> 16;
            }
            p += 0xB4;
        }
        return result;
    case 1:
        for (i = 0; i < 20; i++) {
            if (*(u16 *)(p + 0x708) != 0) {
                result += 1;
                if (*(u16 *)(p + 0x7BA) != 0) {
                    result += 1;
                }
            }
            p += 0xB8;
        }
        break;
    default:
        break;
    }
    return result;
}
