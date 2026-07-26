#include "common.h"

s32 func_80022F1C(s32 arg0) {
    s32 idx;
    char *base;
    s16 val;
    char *ptr;
    u16 result;

    idx = (s16)arg0;
    base = (char *)&D_8006C838;
    val = D_80055988[idx];
    ptr = base + val * 468;
    result = *(u16 *)(ptr + 0x99EC);
    if (result < 5000) {
        return 0;
    }
    if (result < 20000) {
        return 1;
    }
    if (result < 30000) {
        return 2;
    }
    if (result < 40000) {
        return 3;
    }
    if (result < 50000) {
        return 4;
    }
    if (result < 60000) {
        return 5;
    }
    return 6;
}
