#include "common.h"

s32 func_80012A34(s32 arg0);

typedef struct {
    s32 unk0;
    s32 unk4;
    s32 unk8;
} E2654;

s32 ovl_11_func_800E2654(E2654 *src, E2654 *dst) {
    s32 result;
    s32 lo;
    s32 hi;
    s32 range;

    result = 0;
    dst->unk4 = src->unk4;

    if (src->unk0 < -1000 || src->unk0 > 1200) {
        dst->unk0 = func_80012A34(0x898) - 1000;
        result = 1;
    } else {
        dst->unk0 = src->unk0;
    }

    if (src->unk8 >= 0) {
        hi = 1700;
        lo = 400;
        range = 1300;
    } else {
        hi = -500;
        lo = -2000;
        range = 1500;
    }
    if (hi < src->unk8 || src->unk8 < lo) {
        dst->unk8 = lo + func_80012A34(range);
        result = 1;
    } else {
        dst->unk8 = src->unk8;
    }
    return result;
}
