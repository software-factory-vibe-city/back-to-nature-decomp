#include "common.h"

s32 func_8001D21C(s32 arg0, s32 arg1, s32 arg2) {
    s32 lv0;
    s32 lv1;

    lv0 = (s16)(arg0 + 1);
    lv0 += 0x13;
    if ((u16)lv0 < 0x1A3) {
        goto LABEL;
    }

    lv0 = (s16)(arg1 + 1);
    lv0 += 0x13;
    if ((u16)lv0 < 0x1A3) {
        goto LABEL;
    }

    lv0 = (s16)(arg2 + 1);
    lv0 += 0x13;
    if ((u16)lv0 < 0x1A3) {
        goto LABEL;
    }

    return 0;

LABEL:
    lv1 = (s16)arg0;
    if ((u16)(lv1 + 0x13) < 0x153) {
        return 1;
    }

    lv1 = (s16)arg1;
    if ((u16)(lv1 + 0x13) < 0x153) {
        return 1;
    }

    lv1 = (s16)arg2;
    return (u16)(lv1 + 0x13) < 0x153;
}
