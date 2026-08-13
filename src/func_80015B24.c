#include "common.h"

s32 func_800129E8(void);
int bcmp(const void *, const void *, int);

s32 func_80015B24(s32 arg0, s32 arg1, u16 arg2) {
    s32 s1 = arg1 + 4;
    s32 s2 = 0;
    s32 mask = 0xFFFFFF;
    s32 count;
    s32 offset;

    count = *(u16 *)((char *)arg1 + 2);
    offset = arg2 << 3;

    while (s2 < count) {
        s32 header = *(s32 *)s1;
        s32 temp = header & mask;
        s32 total;
        if (bcmp((char *)*(s32 **)((char *)arg0 + 0x1C) + offset,
                 (char *)s1 + 4, 8) == 0) break;
        total = ((((u32)temp + 3) >> 2) << 2) + 12;
        s1 += total;
        s2++;
    }

    if (s2 == count) {
        do {
        } while (func_800129E8() != 0);
    }

    return s2 & 0xFFFF;
}
